"""The demo frontend is the Phase 4 acceptance surface (DESIGN §5): it must
be served by the API itself so a clean clone shows the whole flow at /demo."""


def test_demo_page_served(client):
    r = client.get("/demo/")
    assert r.status_code == 200
    assert "GlycoTwin" in r.text
    # one section per acceptance step
    for marker in ("M4", "M5", "M3", "M6", "M7", "M8"):
        assert marker in r.text, marker
