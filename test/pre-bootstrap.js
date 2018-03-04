/*
 * Tests which are run before `npm run bootstrap` regenerates
 * nearley-language-bootstrapped.js. Not much use otherwise!
 */

const fs = require('fs');
const expect = require('expect');

const nearley = require('../lib/nearley');
const {compile, parse} = require('./_shared');

function read(filename) {
    return fs.readFileSync(filename, 'utf-8');
}

describe('bootstrapped lexer', () => {

    const lexer = compile(read("lib/nearley-language-bootstrapped.ne")).lexer;
    function lex(source) {
        return Array.from(lexer.reset(source)).map(tok => tok.type + " " + tok.value)
    }
    function lexTypes(source) {
        return Array.from(lexer.reset(source)).map(tok => tok.type)
    }


    it('lexes directives', () => {
      expect(lex("@builtin 'quxx'")).toEqual([
          "@builtin @builtin",
          "ws  ",
          "string quxx",
      ])
      expect(lex("@lexer moo")).toEqual([
          "@ @",
          "word lexer",
          "ws  ",
          "word moo",
      ])
    })

    it('lexes a simple rule', () => {
      expect(lex("foo -> bar")).toEqual([
          "word foo",
          "ws  ",
          "arrow ->",
          "ws  ",
          "word bar",
      ])
    })

    it('lexes arrows', () => {
      expect(lex("->")).toEqual(["arrow ->"])
      expect(lex("=>")).toEqual(["arrow =>"])
      expect(lex("-=->")).toEqual(["arrow -=->"])
    })

    it('lexes js code', () => {
      expect(lexTypes("{% foo % %}")).toEqual(['js'])
      expect(lexTypes("{% function() %}")).toEqual(['js'])
      expect(lexTypes("{% %}")).toEqual(['js'])
      expect(lexTypes("{%%}")).toEqual(['js'])
    })

    it('lexes charclasses', () => {
      expect(lex(".")).toEqual([
        "charclass /./",
      ])
      expect(lex("[^a-z\\s]")).toEqual([
        "charclass /[^a-z\\s]/",
      ])
      expect(lex("foo->[^a-z\\s]")).toEqual([
        "word foo",
        "arrow ->",
        "charclass /[^a-z\\s]/",
      ])
    })

    it('rejects newline in charclass', () => {
      expect(() => lex("[foo\n]")).toThrow()
    })

    it('lexes macros', () => {
      expect(lex("foo[X, Y]")).toEqual([
        "word foo",
        "[ [",
        "word X",
        ", ,",
        "ws  ",
        "word Y",
        "] ]",
      ])
      expect(lex("foo[[0-9]]")).toEqual([
        "word foo",
        "[ [",
        "charclass /[0-9]/",
        "] ]",
      ])
    })

    it('lexes strings', () => {
      expect(lex(`'foo'`)).toEqual(['string foo'])
      expect(lex(`"bar"`)).toEqual(['string bar'])
      expect(lex(`'I\\"m\\\\'`)).toEqual(["string I\"m\\"])
      expect(lex('"foo\\"b\\\\ar\\n"')).toEqual(['string foo"b\\ar\n'])
      expect(lex('"\\u1234"')).toEqual(['string \u1234'])
    })

    it('lexes strings non-greedily ', () => {
      expect(lexTypes("'foo' 'bar'")).toEqual(["string", "ws", "string"])
      expect(lexTypes('"foo" "bar"')).toEqual(["string", "ws", "string"])
    })

})

describe('bootstrapped parser', () => {

    const grammar = compile(read("lib/nearley-language-bootstrapped.ne"));
    const bootstrappedGrammar = nearley.Grammar.fromCompiled(require("../lib/nearley-language-bootstrapped"))

    const check = source => expect(parse(grammar, source)).toEqual(parse(bootstrappedGrammar, source))

    it('parses directives', () => {
        check("@lexer moo")
        check('@include "foo"')
        check('@builtin "bar"')
    })

    it('parses simple rules', () => {
        check('foo -> "waffle"')
        check("foo -> bar")
    })

    it('parses postprocessors', () => {
        check('foo -> "waffle" {% d => d[0] %}')
        check('foo -> "waffle" {%\nfunction(d) { return d[0]; }\n%}')
    })

    it('parses js code', () => {
        check("@{%\nconst moo = require('moo');\n%}")
    })

    it('parses options', () => {
        check("foo -> bar\n  | quxx")
    })

    it('parses tokens', () => {
        check("foo -> %foo")
    })

    it('parses charclasses', () => {
        check('char -> .')
        check('y -> x:+\nx -> [a-z0-9] | "\\n"')
        check('m_key -> "any" {% id %} | [a-z0-9] {% id %}')
    })

    it('parses macro definitions', () => {
        check('foo[X] -> X')
        check('foo[X, Y] -> X')
    })

    it('parses macro use', () => {
        check('Y -> foo[Q]')
        check('Y -> foo[Q, P]')
        check('Y -> foo["string"]')
        check('Y -> foo[%tok]')
        check('Y -> foo[(baz quxx)]')
    })

})
