from enum import Enum
from pydantic import BaseModel, Field
from typing import Literal, List, Dict, Any, Optional
import datetime 

# Define the shape of the data the client will send
class ExpenseCreate(BaseModel):
    date: datetime.date
    merchant: str
    amount: float
    description: str | None = None
    expense_category: str  # e.g., "GROCERIES", "DINING_OUT"
    confidence: float
    input_method: str  # e.g., "MANUAL", "TEXT_PASTE", "IMAGE"
    items: Optional[List[Dict[str, Any]]] = None

# Your existing request model
class TextPart(BaseModel):
    type: Literal["text"]
    text: str

class UIMessage(BaseModel):
    id: str
    role: Literal["user", "assistant", "system"]
    parts: List[TextPart]

class ChatRequest(BaseModel):
    messages: List[UIMessage]


# Tool Calling models and enums

class ExpenseCategory(str, Enum):
    HOUSING = "HOUSING"
    UTILITIES = "UTILITIES"
    GROCERIES = "GROCERIES"
    TRANSPORTATION = "TRANSPORTATION"
    TELECOM = "TELECOM"
    HEALTHCARE = "HEALTHCARE"
    DEBT_REPAYMENT = "DEBT_REPAYMENT"
    EDUCATION = "EDUCATION"
    PETS = "PETS"
    DINING_OUT = "DINING_OUT"
    ENTERTAINMENT = "ENTERTAINMENT"
    SHOPPING = "SHOPPING"
    TRAVEL = "TRAVEL"
    HOBBIES_FITNESS = "HOBBIES_FITNESS"
    GIFTS_DONATIONS = "GIFTS_DONATIONS"
    PERSONAL_CARE = "PERSONAL_CARE"
    SUBSCRIPTIONS = "SUBSCRIPTIONS"
    EMERGENCY_FUND = "EMERGENCY_FUND"
    INVESTMENTS = "INVESTMENTS"
    RETIREMENT = "RETIREMENT"
    SAVINGS_GOALS = "SAVINGS_GOALS"
    UNCATEGORIZED = "UNCATEGORIZED"

class InputMethod(str, Enum):
    MANUAL = "MANUAL"
    TEXT_PASTE = "TEXT_PASTE"
    IMAGE = "IMAGE"

class LineItem(BaseModel):
    """A single line item within an expense."""
    description: str = Field(description="Description of the line item.")
    amount: float = Field(description="Amount for this line item.")

class ExpenseToolInput(BaseModel):
    """Input schema for creating an expense record."""
    date: datetime.date = Field(description="Date of the expense in YYYY-MM-DD format.")
    merchant: str = Field(description="Name of the merchant or vendor.")
    amount: float = Field(description="Total amount spent. Must be greater than 0.")
    description: Optional[str] = Field(default=None, description="Brief description of the expense.")
    expense_category: ExpenseCategory = Field(description="Category of the expense, must be one of the allowed types.")
    confidence: float = Field(description="Confidence score of the extraction, between 0 and 1.")
    input_method: InputMethod = Field(description="How the expense was input, e.g., 'MANUAL', 'TEXT_PASTE', 'IMAGE'.")
    items: Optional[List[LineItem]] = Field(default=None, description="List of individual line items, if applicable.")