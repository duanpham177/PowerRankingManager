import argparse
import copy
import getpass
import hashlib
import hmac
import json
import os
import secrets
import threading
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from ..config import *
from ..storage.repository import *
from ..auth.service import *
from ..ranking.service import *
from ..drinks.service import *
