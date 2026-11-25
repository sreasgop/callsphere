from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

UID_PATTERN = r"^\d{10}$"


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=6, max_length=128)

    @field_validator("full_name", "email")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        if "@" not in value or "." not in value.split("@")[-1]:
            raise ValueError("Invalid email address")
        return value.lower()


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class UpdateSettingsRequest(BaseModel):
    status_message: str = Field(default="Available", min_length=1, max_length=150)
    privacy_mode: Literal["everyone", "contacts_only", "dnd"] = "everyone"

    @field_validator("privacy_mode", mode="before")
    @classmethod
    def normalize_privacy(cls, value: str) -> str:
        if value == "contacts":
            return "contacts_only"
        return value


class AddContactRequest(BaseModel):
    contact_uid: str = Field(pattern=UID_PATTERN)
    contact_name: str | None = Field(default=None, max_length=100)


class BlockUidRequest(BaseModel):
    blocked_uid: str = Field(pattern=UID_PATTERN)


class LogCallRequest(BaseModel):
    callee_uid: str = Field(pattern=UID_PATTERN)
    status: Literal["ringing", "active", "completed", "missed", "declined", "busy"]
    duration: int = Field(default=0, ge=0, le=86400)


class CreateGroupRequest(BaseModel):
    group_name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=255)


class JoinGroupRequest(BaseModel):
    group_uid: str = Field(pattern=UID_PATTERN)


class UpdateGroupRequest(BaseModel):
    group_uid: str = Field(pattern=UID_PATTERN)
    group_name: str = Field(min_length=1, max_length=100)


class GroupMemberRequest(BaseModel):
    group_uid: str = Field(pattern=UID_PATTERN)
    user_uid: str = Field(pattern=UID_PATTERN)


class OtpVerifyRequest(BaseModel):
    challenge_token: str = Field(min_length=10, max_length=1024)
    otp: str = Field(pattern=r"^\d{6}$")


class TwoFactorToggleRequest(BaseModel):
    enabled: bool


class PublishKeyRequest(BaseModel):
    public_key_jwk: dict[str, object]


class MarkReadRequest(BaseModel):
    sender_uid: str = Field(pattern=UID_PATTERN)
