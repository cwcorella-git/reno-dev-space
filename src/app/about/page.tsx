export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">About the Collective</h1>
        <p className="text-xl text-gray-300">
          A different kind of game dev community
        </p>
      </div>

      {/* The Story */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">The Vision</h2>
        <div className="prose prose-invert max-w-none space-y-4 text-gray-300">
          <p>
            We&apos;re building Reno&apos;s first game developer collective &mdash; a shared space
            for creators who want to work together without the corporate overhead.
          </p>
          <p>
            The goal is simple: get enough people together to rent a dedicated workspace.
            Artists, programmers, sound designers, writers, composers &mdash; people who want
            to make games, not just play them.
          </p>
          <p>
            We find projects we&apos;re enthusiastic about and choose how and when to contribute.
            Members can commercialize their work, but they don&apos;t owe the space anything.
            If you want to give back, do it by improving the space for everyone.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">How It Works</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-3 text-brand-primary">Horizontal Structure</h3>
            <p className="text-gray-300">
              No producers, no executives. We take a considered approach from
              Valve&apos;s organizational structure &mdash; free association. Leave or join
              projects as you please. The only thing motivating us should be our
              own desire to create.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-3 text-brand-secondary">Democratic Decisions</h3>
            <p className="text-gray-300">
              Everything from the collective&apos;s name to its core values is decided
              by member vote. Proposals need community support to pass. We keep
              things transparent.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-3 text-brand-accent">Not Rev-Share</h3>
            <p className="text-gray-300">
              Your work is yours. Period. We&apos;re not here to extract value from
              successful projects. The objective isn&apos;t money &mdash; it&apos;s funding
              the space so more people can create.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-3 text-green-400">Third Space</h3>
            <p className="text-gray-300">
              Not home, not work. A place to be with people who share your passion.
              Game dev can be isolating &mdash; especially as a solo dev or hobbyist.
              We&apos;re building something different.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <details className="bg-white/5 border border-white/10 rounded-xl p-5 group">
            <summary className="font-semibold cursor-pointer list-none flex justify-between items-center">
              Do I need to be an experienced developer?
              <span className="text-brand-accent group-open:rotate-180 transition-transform">&#9660;</span>
            </summary>
            <p className="mt-3 text-gray-300">
              Not at all. We welcome hobbyists, students, and people just starting out.
              The point is to learn and grow together.
            </p>
          </details>

          <details className="bg-white/5 border border-white/10 rounded-xl p-5 group">
            <summary className="font-semibold cursor-pointer list-none flex justify-between items-center">
              What does membership cost?
              <span className="text-brand-accent group-open:rotate-180 transition-transform">&#9660;</span>
            </summary>
            <p className="mt-3 text-gray-300">
              During the founding phase, online membership is free. Once we secure a
              physical space, we&apos;ll split the costs among members who want access.
              The more people, the cheaper it gets.
            </p>
          </details>

          <details className="bg-white/5 border border-white/10 rounded-xl p-5 group">
            <summary className="font-semibold cursor-pointer list-none flex justify-between items-center">
              Do I have to work on collaborative projects?
              <span className="text-brand-accent group-open:rotate-180 transition-transform">&#9660;</span>
            </summary>
            <p className="mt-3 text-gray-300">
              Nope. Work on your own stuff, contribute to group projects, or just hang
              out and be part of the community. It&apos;s up to you.
            </p>
          </details>

          <details className="bg-white/5 border border-white/10 rounded-xl p-5 group">
            <summary className="font-semibold cursor-pointer list-none flex justify-between items-center">
              What if I make money from something I create?
              <span className="text-brand-accent group-open:rotate-180 transition-transform">&#9660;</span>
            </summary>
            <p className="mt-3 text-gray-300">
              It&apos;s yours. 100%. We&apos;re not rev-share. If you want to give back,
              consider contributing to the space &mdash; hardware, furniture, hosting costs.
              But it&apos;s never required.
            </p>
          </details>

          <details className="bg-white/5 border border-white/10 rounded-xl p-5 group">
            <summary className="font-semibold cursor-pointer list-none flex justify-between items-center">
              How do decisions get made?
              <span className="text-brand-accent group-open:rotate-180 transition-transform">&#9660;</span>
            </summary>
            <p className="mt-3 text-gray-300">
              Through voting on the Governance page. Anyone can propose ideas, and
              proposals need net +5 votes to pass. We&apos;re figuring out the details
              together as we grow.
            </p>
          </details>

          <details className="bg-white/5 border border-white/10 rounded-xl p-5 group">
            <summary className="font-semibold cursor-pointer list-none flex justify-between items-center">
              I&apos;m not in Reno. Can I still join?
              <span className="text-brand-accent group-open:rotate-180 transition-transform">&#9660;</span>
            </summary>
            <p className="mt-3 text-gray-300">
              Yes! The online community is open to anyone. Remote collaboration is
              welcome. The physical space is Reno-based, but the collective is bigger
              than that.
            </p>
          </details>
        </div>
      </section>

      {/* Values */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">What We Believe In</h2>
        <p className="text-gray-400 mb-6">
          These are our starting principles. As a founding member, you can vote to change them.
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[
            'Creation over consumption',
            'People over profit',
            'Collaboration over competition',
            'Transparency in decisions',
            'Respect for all skill levels',
            'Free association',
          ].map((value) => (
            <div
              key={value}
              className="bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10 border border-white/10 rounded-xl p-4 text-center"
            >
              {value}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center bg-gradient-to-r from-brand-primary/20 to-brand-secondary/20 rounded-xl p-8">
        <h2 className="text-2xl font-bold mb-4">Ready to Build Together?</h2>
        <p className="text-gray-300 mb-6">
          Join the founding members and help shape what this becomes.
        </p>
        <a
          href="/join"
          className="inline-block bg-brand-primary hover:bg-brand-secondary text-white px-8 py-3 rounded-lg font-semibold transition-colors"
        >
          Join the Collective
        </a>
      </section>
    </div>
  )
}
