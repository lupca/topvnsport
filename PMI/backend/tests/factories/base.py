import factory
from factory.alchemy import SQLAlchemyModelFactory

class BaseFactory(SQLAlchemyModelFactory):
    """
    Base factory for all SQLAlchemy models.
    The session is injected dynamically during test setup.
    """
    class Meta:
        abstract = True
