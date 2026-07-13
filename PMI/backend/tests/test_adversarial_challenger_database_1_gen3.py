import pytest
import uuid
import datetime
from collections.abc import Mapping, Sequence
from models import AuditOutbox, AuditLog, ActorType, OutboxStatus
from utils.masking import mask_sensitive_data
from sqlalchemy import text

def test_masking_depth_boundaries():
    # Nesting exactly 100 levels should NOT raise an error
    dict_99 = {}
    curr = dict_99
    for _ in range(99):
        curr["nested"] = {}
        curr = curr["nested"]
    mask_sensitive_data(dict_99)

    dict_100 = {}
    curr = dict_100
    for _ in range(100):
        curr["nested"] = {}
        curr = curr["nested"]
    mask_sensitive_data(dict_100)

    dict_101 = {}
    curr = dict_101
    for _ in range(101):
        curr["nested"] = {}
        curr = curr["nested"]
    with pytest.raises(ValueError, match="Payload nesting depth limit exceeded"):
        mask_sensitive_data(dict_101)

def test_complex_cycles():
    # Cycle in dict
    d = {}
    d["cycle"] = d
    res = mask_sensitive_data(d)
    assert res["cycle"] == "***CYCLE DETECTED***"

    # Cycle in list
    lst = []
    lst.append(lst)
    res_lst = mask_sensitive_data(lst)
    assert res_lst == ["***CYCLE DETECTED***"]

    # Cycle in tuple
    lst_in_tuple = []
    tup = (lst_in_tuple,)
    lst_in_tuple.append(tup)
    res_tup = mask_sensitive_data(tup)
    assert res_tup[0][0] == "***CYCLE DETECTED***"

    # DAG (Shared subtree, NOT a cycle)
    shared = {"key": "value"}
    dag = {"a": shared, "b": shared}
    res_dag = mask_sensitive_data(dag)
    assert res_dag["a"] == {"key": "value"}
    assert res_dag["b"] == {"key": "value"}
    assert res_dag["a"] is not shared
    assert res_dag["b"] is not shared
    assert res_dag["a"] is not res_dag["b"]

def test_weird_collections():
    class HashableDict(dict):
        def __hash__(self):
            return hash(frozenset(self.items()))
    
    hd = HashableDict({"password": "xyz"})
    s = {hd}
    res_s = mask_sensitive_data(s)
    # Masking returns a normal dict which is not hashable, so the set constructor fails and it returns a list
    assert isinstance(res_s, list)
    assert res_s[0]["password"] == "***MASKED***"

    # Custom mapping class
    class CustomMap(Mapping):
        def __init__(self, data):
            self._data = data
        def __getitem__(self, key):
            return self._data[key]
        def __len__(self):
            return len(self._data)
        def __iter__(self):
            return iter(self._data)
    
    cm = CustomMap({"password": "abc", "normal": "def"})
    res_cm = mask_sensitive_data(cm)
    assert isinstance(res_cm, dict)
    assert res_cm["password"] == "***MASKED***"
    assert res_cm["normal"] == "def"

def test_db_server_defaults_and_guest_gen3(db_session):
    # 1. Raw SQL insert omitting created_at and processed_at
    corr_id = uuid.uuid4()
    outbox_id = uuid.uuid4()
    db_session.execute(text("""
        INSERT INTO audit_outbox (id, correlation_id, actor_username, actor_type, source_service, module, action_type, status, attempt_count)
        VALUES (:id, :corr_id, 'sql_actor', 'GUEST', 'PMI', 'Product', 'CREATE', 'PENDING', 0)
    """), {"id": outbox_id, "corr_id": corr_id})
    db_session.commit()

    # Retrieve and verify
    retrieved_outbox = db_session.query(AuditOutbox).filter_by(correlation_id=corr_id).first()
    assert retrieved_outbox is not None
    assert retrieved_outbox.actor_type == ActorType.GUEST
    assert retrieved_outbox.created_at is not None
    assert retrieved_outbox.created_at.tzinfo is not None

    # Let's test AuditLog raw insertion with GUEST
    log_id = uuid.uuid4()
    db_session.execute(text("""
        INSERT INTO audit_logs (id, correlation_id, actor_username, actor_type, source_service, module, action_type)
        VALUES (:id, :corr_id, 'sql_actor', 'GUEST', 'PMI', 'Product', 'CREATE')
    """), {"id": log_id, "corr_id": corr_id})
    db_session.commit()

    retrieved_log = db_session.query(AuditLog).filter_by(correlation_id=corr_id).first()
    assert retrieved_log is not None
    assert retrieved_log.actor_type == ActorType.GUEST
    assert retrieved_log.created_at is not None
    assert retrieved_log.created_at.tzinfo is not None
    assert retrieved_log.processed_at is not None
    assert retrieved_log.processed_at.tzinfo is not None
