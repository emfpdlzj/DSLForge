grammar PackageScriptFixture

entry Model:
    items+=Item*;

Item:
    'item' name=ID;

terminal ID: /[_a-zA-Z][\w]*/;
hidden terminal WS: /\s+/;
