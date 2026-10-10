"""The learner's own profile (anonymous id in the X-Learner-Id header). Off when no database is configured."""
from __future__ import annotations

from fastapi import APIRouter, Header
from pydantic import BaseModel, Field

from ..services import profiles

router = APIRouter(prefix="/api", tags=["me"])


class ProfileBody(BaseModel):
    profile: dict = Field(default_factory=dict)


@router.get("/me")
def get_me(x_learner_id: str | None = Header(default=None)) -> dict:
    learner = profiles.check_id(x_learner_id)
    return {"profile": profiles.get_profile(learner)}


@router.put("/me")
def put_me(body: ProfileBody, x_learner_id: str | None = Header(default=None)) -> dict:
    learner = profiles.check_id(x_learner_id)
    profiles.put_profile(learner, body.profile)
    return {"saved": True}


@router.delete("/me")
def delete_me(x_learner_id: str | None = Header(default=None)) -> dict:
    learner = profiles.check_id(x_learner_id)
    profiles.delete_learner(learner)
    return {"deleted": True}
