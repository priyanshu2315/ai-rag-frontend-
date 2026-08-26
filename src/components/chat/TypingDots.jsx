/** The "thinking" animation shown inside a bubble before the first token. */
const TypingDots = () => (
  <span className="flex items-center gap-1 py-1" role="status" aria-label="Thinking">
    {[0, 150, 300].map((delay) => (
      <span
        key={delay}
        className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-2"
        style={{ animationDelay: `${delay}ms` }}
      />
    ))}
  </span>
);

export default TypingDots;
