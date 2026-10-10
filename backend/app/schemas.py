"""Request bodies. Responses are the stored Lesson / Lecture JSON described in docs/PLAN.md section 6."""
from typing import Literal

from pydantic import BaseModel, Field

Level = Literal["easier", "simplest"]


class LevelRequest(BaseModel):
    level: Level = "easier"


class QuizRequest(BaseModel):
    level: Level = "easier"
    count: Literal[5, 10, 15] = 15
    section_ids: list[str] = Field(default_factory=list, max_length=50)  # empty = the whole page
    fresh: bool = False  # True = new questions instead of the last quiz with the same settings


class QuizCheck(BaseModel):
    question_id: str = Field(max_length=20)
    answer: str = Field(default="", max_length=300)


class QuizAnswers(BaseModel):
    answers: dict[str, str] = Field(default_factory=dict)
    timed_out: list[str] = Field(default_factory=list, max_length=50)
    mode: Literal["tap", "voice"] = "tap"


class VideoRequest(BaseModel):
    url: str = Field(min_length=5, max_length=500)
    language: Literal["auto", "en", "ur", "ps", "hi"] = "auto"
    lesson_id: str | None = Field(default=None, max_length=64)
