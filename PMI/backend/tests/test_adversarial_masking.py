import pytest
from utils.masking import mask_sensitive_data

def test_mask_nested_lists_of_dicts():
    # Nested lists of lists of dictionaries
    payload = [[{"password": "secret", "normal_key": "normal"}]]
    masked = mask_sensitive_data(payload)
    assert masked == [[{"password": "***MASKED***", "normal_key": "normal"}]]
    
    # Verify deep copy / mutability
    assert masked is not payload
    assert masked[0] is not payload[0]
    assert masked[0][0] is not payload[0][0]

def test_mask_strange_casing():
    # Dictionary keys with strange casing
    payload = {
        "PaSsWoRd": "pwd",
        "ACCESS_TOKEN": "tok",
        "reFrEsH_toKeN": "ref",
        "APP_seCrEt": "sec",
        "normal_key": "val"
    }
    masked = mask_sensitive_data(payload)
    assert masked == {
        "PaSsWoRd": "***MASKED***",
        "ACCESS_TOKEN": "***MASKED***",
        "reFrEsH_toKeN": "***MASKED***",
        "APP_seCrEt": "***MASKED***",
        "normal_key": "val"
    }

def test_mask_non_dict_payloads_and_primitives():
    # Primitive values
    assert mask_sensitive_data(None) is None
    assert mask_sensitive_data(123) == 123
    assert mask_sensitive_data("string") == "string"
    assert mask_sensitive_data(3.14) == 3.14
    assert mask_sensitive_data(True) is True

    # Custom object as payload
    class CustomObj:
        def __init__(self):
            self.password = "secret"
    obj = CustomObj()
    assert mask_sensitive_data(obj) is obj

def test_mask_tuples_and_sets():
    # Tuple containing dict with sensitive key
    payload = {"data": (1, 2, {"password": "secret"})}
    masked = mask_sensitive_data(payload)
    
    # Assert that it now correctly masks the sensitive data inside tuples
    assert masked["data"][2]["password"] == "***MASKED***"
    # Assert that a new copy is returned
    assert masked["data"][2] is not payload["data"][2]

def test_circular_reference_recursion_error():
    # Circular reference should be handled gracefully with cycle detection instead of crashing
    payload = {}
    payload["self"] = payload
    
    masked = mask_sensitive_data(payload)
    assert masked["self"] == "***CYCLE DETECTED***"


def test_mask_mutability_references():
    # Confirm returned dict is a deep copy and does not share mutable references
    payload = {
        "user": {
            "name": "john",
            "roles": ["admin", "user"],
            "extra": {"joined": "2026"}
        }
    }
    masked = mask_sensitive_data(payload)
    
    assert masked is not payload
    assert masked["user"] is not payload["user"]
    assert masked["user"]["roles"] is not payload["user"]["roles"]
    assert masked["user"]["extra"] is not payload["user"]["extra"]

    # Let's check other mutable types, like a set or a dict subclass
    import collections
    payload_subclass = collections.defaultdict(list)
    payload_subclass["password"] = "secret"
    payload_subclass["normal"] = ["a", "b"]
    masked_subclass = mask_sensitive_data(payload_subclass)
    
    # Check if a dict subclass is converted to a plain dict
    assert isinstance(masked_subclass, dict)
    assert not isinstance(masked_subclass, collections.defaultdict)
    assert masked_subclass["password"] == "***MASKED***"
    assert masked_subclass["normal"] is not payload_subclass["normal"]


def test_mask_sets_and_frozensets():
    # Since sets cannot contain unhashable dicts, they fallback to a list if they contain dictionaries
    class HashableDict(dict):
        def __hash__(self):
            return hash(frozenset(self.items()))
    
    dict_with_secret = HashableDict({"password": "secret_password", "normal": 42})
    
    # 1. Test set containing hashable dict (falls back to list because plain dict is returned and is unhashable)
    set_payload = {dict_with_secret}
    masked_set = mask_sensitive_data(set_payload)
    assert isinstance(masked_set, list)
    assert len(masked_set) == 1
    assert masked_set[0]["password"] == "***MASKED***"
    assert masked_set[0]["normal"] == 42

    # 2. Test frozenset containing hashable dict (falls back to list because plain dict is returned and is unhashable)
    frozenset_payload = frozenset([dict_with_secret])
    masked_frozenset = mask_sensitive_data(frozenset_payload)
    assert isinstance(masked_frozenset, list)
    assert len(masked_frozenset) == 1
    assert masked_frozenset[0]["password"] == "***MASKED***"
    assert masked_frozenset[0]["normal"] == 42

    # 3. Test set containing a tuple which contains a hashable dict (falls back to list during masking because mapping is converted to unhashable plain dict)
    tuple_payload = {(1, dict_with_secret)}
    masked_tuple_set = mask_sensitive_data(tuple_payload)
    assert isinstance(masked_tuple_set, list)
    assert masked_tuple_set[0][1]["password"] == "***MASKED***"
    assert masked_tuple_set[0][1]["normal"] == 42

    # 4. Test set of simple hashable primitives where the set type is preserved
    simple_set = {"normal_val", "another_val"}
    masked_simple = mask_sensitive_data(simple_set)
    assert isinstance(masked_simple, set)
    assert masked_simple == {"normal_val", "another_val"}

    # 5. Test frozenset of simple hashable primitives where the frozenset type is preserved
    simple_frozenset = frozenset(["val1", "val2"])
    masked_frozen = mask_sensitive_data(simple_frozenset)
    assert isinstance(masked_frozen, frozenset)
    assert masked_frozen == frozenset(["val1", "val2"])



def test_mask_deep_linear_nesting_limits():
    # 1. Nesting dict 105 levels deep
    deep_dict = {}
    curr = deep_dict
    for _ in range(105):
        curr["nested"] = {}
        curr = curr["nested"]
    
    with pytest.raises(ValueError, match="Payload nesting depth limit exceeded"):
        mask_sensitive_data(deep_dict)

    # 2. Nesting list 105 levels deep
    deep_list = [1]
    for _ in range(105):
        deep_list = [deep_list]
    
    with pytest.raises(ValueError, match="Payload nesting depth limit exceeded"):
        mask_sensitive_data(deep_list)


def test_mask_custom_sequences_evaluated_list_safety():
    from collections.abc import Sequence

    # 1. Custom sequence that accepts a list in constructor
    class GoodCustomSequence(Sequence):
        def __init__(self, items):
            self._items = list(items)
        def __getitem__(self, index):
            return self._items[index]
        def __len__(self):
            return len(self._items)
            
    payload_good = GoodCustomSequence([{"password": "secret", "val": 1}])
    masked_good = mask_sensitive_data(payload_good)
    assert isinstance(masked_good, GoodCustomSequence)
    assert masked_good[0]["password"] == "***MASKED***"
    assert masked_good[0]["val"] == 1

    # 2. Custom sequence that raises TypeError when constructed with list
    class BadCustomSequence(Sequence):
        def __init__(self, items):
            if not isinstance(items, tuple):
                raise TypeError("Only tuples allowed")
            self._items = items
        def __getitem__(self, index):
            return self._items[index]
        def __len__(self):
            return len(self._items)

    payload_bad = BadCustomSequence(({"password": "secret", "val": 2},))
    masked_bad = mask_sensitive_data(payload_bad)
    # Since constructor raises TypeError for evaluated list, it falls back to list
    assert isinstance(masked_bad, list)
    assert masked_bad[0]["password"] == "***MASKED***"
    assert masked_bad[0]["val"] == 2

