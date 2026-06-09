grammar ConfiguredFixture

entry Model:
    items+=Item*;

Item:
    NumberDecl | StringDecl;

NumberDecl:
    '냥?' name=NAME value=CATSEQ;

StringDecl:
    '냐옹?' name=NAME value=STRING;

terminal CATSEQ: /(냥)+/;
terminal NAME: /[^\s]+/;
terminal STRING: /[^\s]+/;

hidden terminal WS: /\s+/;
