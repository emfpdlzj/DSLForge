grammar ImportContextFixture

import './shared'

entry Model:
    elements+=Element*;

Element:
    'element' name=Identifier;
