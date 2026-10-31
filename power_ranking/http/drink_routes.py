from .common import *

class DrinkRoutes:
    def handle_save_drink_shop(self, body):
        if self.require_roles("Admin", "Operator") is None:
            return

        shops = body.get("shops")
        orders = body.get("orders")
        next_order_id = body.get("next_order_id")
        if not isinstance(shops, list) or not isinstance(orders, list):
            self.send_error_json(
                HTTPStatus.BAD_REQUEST, "Shops and orders must be lists."
            )
            return
        if (
            not is_plain_int(next_order_id)
            or next_order_id < 1
            or len(shops) > 100
            or len(orders) > 5000
        ):
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Drink menu or order data is outside the allowed limits.",
            )
            return

        shops_by_id = {}
        normalized_shops = []
        seen_menu_ids = set()
        for shop in shops:
            if not isinstance(shop, dict):
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST, "Invalid drink shop."
                )
                return
            shop_id = shop.get("id")
            name = shop.get("name")
            menu = shop.get("menu")
            if (
                not isinstance(shop_id, str)
                or not shop_id
                or len(shop_id) > 80
                or shop_id in shops_by_id
                or not isinstance(name, str)
                or not name.strip()
                or len(name.strip()) > 120
                or not isinstance(menu, list)
                or len(menu) > 500
            ):
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "Shops need a unique ID, name, and a menu list.",
                )
                return

            menu_by_id = {}
            normalized_menu = []
            for item in menu:
                if not isinstance(item, dict):
                    self.send_error_json(
                        HTTPStatus.BAD_REQUEST, "Invalid menu item."
                    )
                    return
                item_id = item.get("id")
                item_name = item.get("name")
                category = item.get("category")
                prices = item.get("prices")
                if (
                    not isinstance(item_id, str)
                    or not item_id
                    or len(item_id) > 80
                    or item_id in seen_menu_ids
                    or not isinstance(item_name, str)
                    or not item_name.strip()
                    or len(item_name.strip()) > 120
                    or not isinstance(category, str)
                    or category not in {"drink", "topping"}
                    or not isinstance(prices, dict)
                ):
                    self.send_error_json(
                        HTTPStatus.BAD_REQUEST,
                        "Menu items need a unique ID, name, category, and prices.",
                    )
                    return
                normalized_prices = {}
                for size in ("S", "M", "L"):
                    price = prices.get(size)
                    if price is not None and (
                        not is_plain_int(price)
                        or not 0 <= price <= 1000000
                    ):
                        self.send_error_json(
                            HTTPStatus.BAD_REQUEST,
                            "Menu prices must be whole numbers from 0 to 1,000,000.",
                        )
                        return
                    normalized_prices[size] = price
                if all(price is None for price in normalized_prices.values()):
                    self.send_error_json(
                        HTTPStatus.BAD_REQUEST,
                        "Each menu item needs at least one price.",
                    )
                    return
                normalized_item = {
                    "id": item_id,
                    "name": item_name.strip(),
                    "category": category,
                    "prices": normalized_prices,
                }
                seen_menu_ids.add(item_id)
                menu_by_id[item_id] = normalized_item
                normalized_menu.append(normalized_item)

            normalized_shop = {
                "id": shop_id,
                "name": name.strip(),
                "menu": normalized_menu,
            }
            shops_by_id[shop_id] = {
                **normalized_shop,
                "menu_by_id": menu_by_id,
            }
            normalized_shops.append(normalized_shop)

        normalized_orders = []
        seen_order_ids = set()
        for order in orders:
            if not isinstance(order, dict):
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST, "Invalid drink order."
                )
                return
            order_id = order.get("id")
            person = order.get("person")
            shop_id = order.get("shop_id")
            item_id = order.get("item_id")
            size = order.get("size")
            quantity = order.get("quantity")
            topping_ids = order.get("topping_ids")
            order_shop = (
                shops_by_id.get(shop_id)
                if isinstance(shop_id, str)
                else None
            )
            menu_by_id = order_shop["menu_by_id"] if order_shop else {}
            if (
                not is_plain_int(order_id)
                or order_id < 1
                or order_id in seen_order_ids
                or not isinstance(person, str)
                or not person.strip()
                or len(person.strip()) > 120
                or order_shop is None
                or not isinstance(item_id, str)
                or item_id not in menu_by_id
                or menu_by_id[item_id]["category"] != "drink"
                or not isinstance(size, str)
                or size not in {"S", "M", "L"}
                or menu_by_id[item_id]["prices"][size] is None
                or not is_plain_int(quantity)
                or not 1 <= quantity <= 100
                or not isinstance(topping_ids, list)
            ):
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "A drink order has invalid person, item, size, or quantity.",
                )
                return
            available_toppings = {
                menu_item_id
                for menu_item_id, menu_item in menu_by_id.items()
                if menu_item["category"] == "topping"
            }
            if (
                len(topping_ids) > 30
                or any(
                    not isinstance(topping_id, str)
                    or topping_id not in available_toppings
                    for topping_id in topping_ids
                )
                or len(set(topping_ids)) != len(topping_ids)
            ):
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "A drink order contains an invalid or repeated topping.",
                )
                return
            seen_order_ids.add(order_id)
            normalized_orders.append({
                "id": order_id,
                "person": person.strip(),
                "shop_id": shop_id,
                "item_id": item_id,
                "size": size,
                "quantity": quantity,
                "topping_ids": topping_ids,
            })

        if normalized_orders and next_order_id <= max(seen_order_ids):
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "The next order ID must be greater than saved order IDs.",
            )
            return
        with DATA_LOCK:
            saved_drink_shop = {
                "shops": normalized_shops,
                "orders": normalized_orders,
                "next_order_id": next_order_id,
            }
            replace_drink_shop(saved_drink_shop)

        self.send_json(
            HTTPStatus.OK, {"drink_shop": saved_drink_shop}
        )
