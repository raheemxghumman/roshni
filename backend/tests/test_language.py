from app.services.structure import detect_language


def blocks(text):
    return [{"type": "paragraph", "text": text}]


def test_english():
    assert detect_language(blocks("Plants make food from sunlight.")) == "en"


def test_urdu():
    assert detect_language(blocks("پودے سورج کی روشنی سے اپنی خوراک بناتے ہیں۔ یہ عمل ضیائی تالیف کہلاتا ہے۔")) == "ur"


def test_pashto():
    assert detect_language(blocks("بوټي د لمر له رڼا څخه خپل خواړه جوړوي. دې کار ته ضیايي ترکیب ویل کېږي.")) == "ps"


def test_urdu_retroflex_letters_are_not_pashto():
    assert detect_language(blocks("ٹرین ڈبے بڑے گاڑی ٹوکری ڈاک پہاڑ")) == "ur"
