"""Request bodies. Responses are the stored Lesson / Lecture JSON described in docs/PLAN.md section 6."""
from typing import Literal

from pydantic import BaseModel, Field

Level = Literal["easier", "simplest"]


class LevelRequest(BaseModel):
    level: Level = "easier"


class QuizRequest(BaseModel):
    level: Level = "easier"


class QuizAnswers(BaseModel):
    answers: dict[str, str] = Field(default_factory=dict)
