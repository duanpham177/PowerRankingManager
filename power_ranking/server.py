import argparse
from http.server import ThreadingHTTPServer

from .config import HOST, PORT
from .auth.service import reset_admin_password_from_terminal
from .http.handler import PowerRankingHandler


def run_server():
    server = ThreadingHTTPServer((HOST, PORT), PowerRankingHandler)
    print("Power Ranking server is running.")
    print(f"Open http://{HOST}:{PORT} in your browser.")
    print("Press Ctrl+C to stop the server.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down the server.")
    finally:
        server.server_close()


def main():
    parser = argparse.ArgumentParser(description="Power Ranking server")
    parser.add_argument(
        "--reset-admin-password",
        metavar="USERNAME",
        help="Reset an existing Admin password without web login.",
    )
    args = parser.parse_args()
    if args.reset_admin_password:
        raise SystemExit(reset_admin_password_from_terminal(args.reset_admin_password))
    run_server()
