// Warning should be shown for unreachable statement after return (bug 1151931).

load(libdir + "class.js");

if (options().indexOf("werror") == -1)
  options("werror");

function testWarn(code, lineNumber, columnNumber) {
  var caught = false;
  try {
    eval(code);
  } catch (e) {
    caught = true;
    assertEq(e.constructor, SyntaxError);
    assertEq(e.lineNumber, lineNumber);
    assertEq(e.columnNumber, columnNumber);
  }
  assertEq(caught, true, "warning should be caught for " + code);

  caught = false;
  try {
    Reflect.parse(code);
  } catch (e) {
    caught = true;
    assertEq(e.constructor, SyntaxError);
  }
  assertEq(caught, true, "warning should be caught for " + code);
}

function testPass(code) {
  var caught = false;
  try {
    eval(code);
  } catch (e) {
    caught = true;
  }
  assertEq(caught, false, "warning should not be caught for " + code);

  caught = false;
  try {
    Reflect.parse(code);
  } catch (e) {
    caught = true;
  }
  assertEq(caught, false, "warning should not be caught for " + code);
}

testPass(`
function f() {
  return (
    1 + 2
  );
}
`);

// unary expression
testWarn(`
function f() {
  var i = 0;
  return
    ++i;
}
`, 5, 4);
testWarn(`
function f() {
  var i = 0;
  return
    --i;
}
`, 5, 4);

// array
testWarn(`
function f() {
  return
    [1, 2, 3];
}
`, 4, 4);

// block (object)
testWarn(`
function f() {
  return
    {x: 10};
}
`, 4, 4);
testWarn(`
function f() {
  return
  {
    method()
    {
      f();
    }
  };
}
`, 4, 2);

// expression in paren
testWarn(`
function f() {
  return
    (1 + 2);
}
`, 4, 4);

// name
testWarn(`
function f() {
  return
    f;
}
`, 4, 4);

// binary expression
testWarn(`
function f() {
  return
    1 + 2;
}
`, 4, 4);
testWarn(`
function f() {
  return
    .1 + .2;
}
`, 4, 4);

// string
testWarn(`
function f() {
  return
    "foo";
}
`, 4, 4);
testWarn(`
function f() {
  return
    "use struct";
}
`, 4, 4);
testWarn(`
function f() {
  return
    'foo';
}
`, 4, 4);

// template string
testWarn(`
function f() {
  return
    \`foo\${1 + 2}\`;
}
`, 4, 4);
testWarn(`
function f() {
  return
    \`foo\`;
}
`, 4, 4);

// RegExp
testWarn(`
function f() {
  return
    /foo/;
}
`, 4, 4);

// boolean
testWarn(`
function f() {
  return
    true;
}
`, 4, 4);
testWarn(`
function f() {
  return
    false;
}
`, 4, 4);

// null
testWarn(`
function f() {
  return
    null;
}
`, 4, 4);

// this
testWarn(`
function f() {
  return
    this;
}
`, 4, 4);

// new
testWarn(`
function f() {
  return
    new Array();
}
`, 4, 4);

// delete
testWarn(`
function f() {
  var a = {x: 10};
  return
    delete a.x;
}
`, 5, 4);

// yield
testWarn(`
function* f() {
  return
    yield 1;
}
`, 4, 4);

// class
if (classesEnabled()) {
  testWarn(`
function f() {
  return
    class A { constructor() {} };
}
`, 4, 4);
}

// unary expression
testWarn(`
function f() {
  return
    +1;
}
`, 4, 4);
testWarn(`
function f() {
  return
    -1;
}
`, 4, 4);
testWarn(`
function f() {
  return
    !1;
}
`, 4, 4);
testWarn(`
function f() {
  return
    ~1;
}
`, 4, 4);

// eof
testPass(`
var f = new Function("return\\n");
`);

// empty statement
testPass(`
function f() {
  return;
  ; // empty statement
}
`);

// end of block
testPass(`
function f() {
  {
    return
  }
}
`);

// function (hosted)
testPass(`
function f() {
  g();
  return
  function g() {}
}
`);

// if
testWarn(`
function f() {
  return
  if (true)
    1 + 2;
}
`, 4, 2);

// else
testPass(`
function f() {
  if (true)
    return
  else
    1 + 2;
}
`);

// switch
testWarn(`
function f() {
  return
  switch (1) {
    case 1:
      break;
  }
}
`, 4, 2);

// return in switch
testWarn(`
function f() {
  switch (1) {
    case 1:
      return;
      1 + 2;
      break;
  }
}
`, 6, 6);

// break in switch
testPass(`
function f() {
  switch (1) {
    case 1:
      return;
      break;
  }
}
`);

// case
testPass(`
function f() {
  switch (1) {
    case 0:
      return
    case 1:
      break;
  }
}
`);

// default
testPass(`
function f() {
  switch (1) {
    case 0:
      return
    default:
      break;
  }
}
`);

// while
testWarn(`
function f() {
  return
  while (false)
    1 + 2;
}
`, 4, 2);
testPass(`
function f() {
  do
    return
  while (false);
}
`);

// do
testWarn(`
function f() {
  return
  do {
    1 + 2;
  } while (false);
}
`, 4, 2);

// for
testWarn(`
function f() {
  return
  for (;;) {
    break;
  }
}
`, 4, 2);

// break in for
testPass(`
function f() {
  for (;;) {
    return
    break;
  }
}
`, 5, 4);

// continue
testWarn(`
function f() {
  for (;;) {
    return
    continue;
  }
}
`, 5, 4);

// var (hosted)
testPass(`
function f() {
  return
  var a = 1;
}
`);

// const
testWarn(`
function f() {
  return
  const a = 1;
}
`, 4, 2);

// with
testWarn(`
function f() {
  return
  with ({}) {
    1;
  }
}
`, 4, 2);

// return
testWarn(`
function f() {
  return
  return;
}
`, 4, 2);

// try
testWarn(`
function f() {
  return
  try {
  } catch (e) {
  }
}
`, 4, 2);

// throw
testPass(`
function f() {
  return
  throw 1;
}
`);

// debugger
testWarn(`
function f() {
  return
  debugger;
}
`, 4, 2);

// let
testWarn(`
function f() {
  return
  let a = 1;
}
`, 4, 2);

// skip hoisted

testWarn(`
function f() {
  return
  var a = 0;
  (1 + 2);
}
`, 5, 2);

testWarn(`
function f() {
  return
  function f() {}
  var a = 0;
  (1 + 2);
}
`, 6, 2);
