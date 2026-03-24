export default function TopBar({ navigate, rightContent }) {
  return (
    <div className="tb">
      <button className="btn btn-ghost btn-sm home-back" type="button" onClick={() => navigate('home')}>
        Home
      </button>
      <div className="logo">LB Conexao Quiz</div>
      <div className="rt-badge">{rightContent}</div>
    </div>
  );
}
