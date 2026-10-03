# Book guide spec

Each guide distills one book to the ideas that matter most, so the reader gets the book's value in a fraction of the time.

## What to put in
Pull out the few ideas in the book that change how someone thinks or decides, and explain each one precisely enough to use. Leave out everything else: anecdotes that don't carry an idea, repetition, background, the author's biography, and anything the reader already knows.

Rank ideas by how much they change a decision, and how non-obvious they are. An idea that sounds obvious once stated is included only if the book gives a mechanism, number or framework that makes it sharper than common sense.

## Structure
1. Title line. Title, author, year.
2. Thesis. One sentence: the book's central claim, stated as a claim.
3. The main ideas. 5–7 bullets, one or two sentences each, under 200 words in total. If someone read only this, they'd have the core.
4. Ideas. 4–8 sections, as many as the book earns. Each gets a heading using the author's name for the idea where there is one. Each section:
   - The idea, in one or two exact sentences.
   - The mechanism: why it holds, according to the author.
   - The book's own evidence: the specific example, case, number, formula or framework the author uses.
   - The implication: the concrete situation or decision it changes. One or two sentences.
   100–250 words each.
5. Limits. Where the argument breaks: what's been contested, what hasn't held up, where it doesn't generalize. Two or three points, stated as facts.
6. Related. 2–3 other books from the curriculum data file that extend or challenge this one. Title, plus one clause on the connection. Link published guides; show drafts as plain text.

## Fiction guides
Books in a fiction track (The Imagination) use a different structure. Everything else in this spec applies, except that the ideas belong to the story, not to an argument.
1. Title line. Title, author, year.
2. Premise. One or two sentences: the setup, and what the book is really about. Then one line warning that the guide discusses the ending.
3. The main ideas. 5–7 bullets, under 200 words in total: the ideas the story dramatizes.
4. Ideas. 4–8 sections, one per idea. Each section:
   - The idea, in one or two exact sentences.
   - How the story carries it: the specific scene, character or turn of plot.
   - The implication: what it changes in how the reader sees the world. One or two sentences.
   100–250 words each.
5. Where it falls short. Two or three points, stated as facts: dated assumptions, what history or science later showed, blind spots.
6. Related. 2–3 books, fiction or nonfiction, as above.

## Writing rules
- Every sentence carries information. If removing a sentence loses nothing, remove it.
- No introductions, transitions, recaps or closing lines.
- No motivational framing, aphorisms, rhetorical questions, reading advice, exercises, or "you'll find" / "this book will".
- Banned words: explores, delves, journey, powerful, timeless, game-changer, at its core, ultimately, in today's world, it's important to note.
- Plain declarative sentences. Technical terms are fine when the book uses them; define each one once, in a clause.
- Prefer numbers, named frameworks and specific cases over general statements.
- Third person for the author's claims ("Marks argues..."); state implications directly.
- Never mention tracks, levels or the curriculum in guide text.
- No emojis, no exclamation points, no bold inside body text.

Example of the target density (Fooled by Randomness):
> Alternative histories. Judge a decision by the full range of outcomes it could have produced, not the one that occurred. Taleb's case: a $10 million game of Russian roulette. Most players walk away rich, and the result looks like skill. It was a one-in-six chance of death. Implication: a track record is evidence only in proportion to how many others took the same bet and failed. Ask about the losers you can't see before crediting the winner.

## Accuracy
Readers will rely on this guide instead of the book.
- Every idea, example and number must come from the book. If you're not certain an example is the author's, verify it or leave it out.
- State the author's argument as they made it, in its strongest form. Critique goes only in Limits.
- Paraphrase. Quote directly only when the exact wording is the point, you are certain of it, and it's under 25 words. Never approximate a quote.
- Don't reproduce passages.
- For collections (letters, essays, multiple volumes), organize by idea, not by piece.
- For any book making health or medical claims, add one line under the thesis on how strong the evidence is (clinical consensus, mixed, or tradition/practice-based).

## Length
1,200–2,000 words. Shorter if the book has fewer ideas worth keeping.

## Before committing
- Cut any sentence that could appear in a guide to a different book, and any sentence that restates another.
- Use the guide template; save at the path the build expects for the book's slug.
- Set the book's status to "published" in the curriculum data file.
- Run the build and the link check; both must pass.
