from http.server import BaseHTTPRequestHandler

from .base import BaseHandler
from .auth_routes import AuthRoutes
from .user_routes import UserRoutes
from .player_routes import PlayerRoutes
from .match_routes import MatchRoutes
from .drink_routes import DrinkRoutes
from .history_routes import HistoryRoutes


class PowerRankingHandler(
    BaseHandler,
    AuthRoutes,
    UserRoutes,
    PlayerRoutes,
    MatchRoutes,
    DrinkRoutes,
    HistoryRoutes,
    BaseHTTPRequestHandler,
):
    server_version = "PowerRankingServer/1.0"
