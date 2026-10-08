import os

from product.accounts import rate_limit, user


def admit_generation():
    limit = max(1, int(os.getenv("YINGXU_DAILY_GENERATIONS", "20")))
    rate_limit("generation-day:" + user()["id"], limit, 24 * 3600)
