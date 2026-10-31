from copy import deepcopy

from ..storage.repository import DATA_LOCK, drink_shop, write_drink_data_file


def replace_drink_shop(value):
    with DATA_LOCK:
        write_drink_data_file(value)
        drink_shop.clear()
        drink_shop.update(deepcopy(value))
