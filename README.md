# Tenet CSS
_As starred by [Chris Coyier](https://github.com/chriscoyier)!_

> Tenet is a CSS framework which fluidly interpolates not only your entire font stack, but also all whitespace and element sizes.

> Tenet promotes a sensible and maintainable approach to building the frontend of large codebases.

With Tenet you define a small viewport size and a font-size to go with it, as well as a large viewport size and a font-size to go with that. Between these viewport sizes, Tenet fluidly interpolates not only your entire font stack, but also all whitespace and element sizes. In addition to this, you'll define two different ratios (for the minimum and maximum viewport sizes) by which the font-size of your headings will increase, and Tenet will fluidly interpolate between those! 

This means you won't need to write media queries for your font-sizes again, and you'll write far fewer media queries overall, as elements resize fluidly with the viewport.

Tenet also comes with many handy tools pointing you toward a methodology for writing maintainable frontends, with your quality of life in mind, while avoiding introducing technical debt as much as is possible.

## What is this?
Tenet is a sensible toolkit for starting large front-end projects, and for prototyping designs for the web. It is opinionated, and a detailed guide to the suggested methodology for working with this toolkit can be found in the [documentation](https://github.com/trubblebruin/tenet/wiki).

Tenet aims to help reduce the introduction of technical debt, which is useful because you or another human like you will almost certainly end up maintaining the project that you're designing and building now, and they will be happier if you make sensible decisions from the outset.

Tenet has been in use in production in various forms since 2013, though in its original incarnation it was tightly coupled to a CMS. It is currently in production on user-facing government software, amongst other large pieces of software for national and international organisations.

## Who is this for?
This is not a CSS library for engineers looking to add presentational classes to elements and have their MVP app styled quickly; there are already many excellent tools for that.

Tenet is a set of tools and a methodology for front-end engineers and designers who design in-browser, write hundreds (if not thousands) of lines of CSS on a daily basis on large projects, and seek to avoid introducing technical debt.

I design almost entirely in code and in-browser; this isn't just a conference talk about the novelty of a designer-engineer, but rather a practical and well-tested set of tools and ideas to help push that job role forwards in our industry in a meaningful way.

I work closely with excellent backend engineers, and our aim is to make robust software together while maintaining a high quality of life for engineers; reducing repetition, increasing predictability in our codebases etc. It is my opinion that context and methodologies can and should be shared freely, from project managers to designers to engineers, and that the separation of concerns and skills that pervades our industry at present is holding us back, but that's for another time.

## Why is it called Tenet?
I'm glad you asked. Tenet is named after my favourite designer, [Deiter Rams](https://en.wikipedia.org/wiki/Dieter_Rams), and his tenets of [good design](https://www.vitsoe.com/eu/about/good-design); my favourite of which is "good design makes a product understandable".

> Indifference towards people and the reality in which they live is actually the one and only cardinal sin in design.

_Dieter Rams_

> Design should not dominate things, should not dominate people. It should help people. That’s its role.

_Dieter Rams_

## Why does Tenet include a templating system?
The templating system is included to allow this repo to be cloned down and used to make quick design prototypes that can be presented to clients/product-owners in-browser. The templating system is crude and a little clunky, but I've deliberately kept this aspect of Tenet simple, to encourage integration as early as possible with whatever you've decided on to handle the business logic of your project (for instance Django, Vue, Hugo). Nevertheless, it's becoming apparent that for some use-cases the templating system can quickly become messy and limiting. I am reviewing this and deciding on the most flexible way forward, which leads us nicely into...

## I have an idea for Tenet! I have a question about Tenet!
That's great to hear! Please have a peek at the documentation first and then feel free to get in touch with me on Twitter, I'm a friendly person: [@wavetemple](https://twitter.com/wavetemple).

> Tenet is a working reference implementation of responsible design.

_[Gary Stevens](http://bramblefinch.co.uk)_

> There is no place for hope in software development.

_[Jim Hill](https://dammitjim.co.uk), paraphrasing Frederick Phillips Brooks, Jr._
