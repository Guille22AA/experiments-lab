// Placeholder for sections that are not built yet.
export default function ComingSoon({ Icon, title, children }) {
  return (
    <div className="coming-soon">
      <Icon size={48} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
