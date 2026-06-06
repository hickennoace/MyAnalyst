"""Typed application settings loaded from environment (see /.env.example).

Use pydantic-settings so every config value is validated at startup.
Critical invariants to enforce here in production:
    * LLM_ZERO_RETENTION must be True,
    * DB_APP_ROLE must be a non-superuser role that cannot bypass RLS,
    * secrets come from a manager, not plaintext env, when APP_ENV == 'production'.
"""

# from pydantic_settings import BaseSettings


# class Settings(BaseSettings):
#     app_env: str = "local"
#     database_url: str
#     redis_url: str
#     llm_zero_retention: bool = True
#     ...  # TODO: full set per .env.example


# settings = Settings()  # type: ignore[call-arg]
