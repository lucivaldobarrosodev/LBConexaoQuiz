export default function HomePage({ navigate }) {
  return (
    <main className="home-shell">
      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="home-badge">Experiencia ao vivo para sala de aula</div>
          <h1>LB Conexao Quiz</h1>
          <p>
            Uma plataforma de quiz em tempo real para engajar alunos, acompanhar respostas e
            transformar a aula em uma experiencia dinamica, organizada e profissional.
          </p>

          <div className="home-stats">
            <div className="home-stat">
              <strong>Professor no controle</strong>
              <span>Crie salas, edite bancos e conduza a turma com clareza.</span>
            </div>
            <div className="home-stat">
              <strong>Aluno com entrada rapida</strong>
              <span>Participacao por PIN ou QR Code em poucos segundos.</span>
            </div>
            <div className="home-stat">
              <strong>Resultados acionaveis</strong>
              <span>Ranking ao vivo e relatorio final exportavel.</span>
            </div>
          </div>
        </div>

        <div className="home-cta">
          <button className="home-card home-card-prof" type="button" onClick={() => navigate('professor')}>
            <span className="home-card-icon" aria-hidden="true">PR</span>
            <span className="home-card-kicker">Painel de controle</span>
            <strong>Entrar como Professor</strong>
            <small>Monte quizzes, organize perguntas, acompanhe respostas e exporte resultados da turma.</small>
            <span className="home-card-action">Abrir painel do professor</span>
          </button>

          <button className="home-card home-card-student" type="button" onClick={() => navigate('aluno')}>
            <span className="home-card-icon" aria-hidden="true">AL</span>
            <span className="home-card-kicker">Participacao instantanea</span>
            <strong>Entrar como Aluno</strong>
            <small>Digite o PIN, responda rapidamente e acompanhe sua posicao durante o jogo.</small>
            <span className="home-card-action">Entrar na sala como aluno</span>
          </button>
        </div>
      </section>

      <section className="home-grid">
        <article className="home-panel">
          <h2>Como funciona</h2>
          <p>Use a plataforma com um fluxo claro para aula, revisao, treinamento ou dinamica em grupo.</p>
          <ul>
            <li>O professor monta o quiz, define o tempo e abre a sala.</li>
            <li>Os alunos entram por PIN ou QR Code e aguardam no lobby.</li>
            <li>Durante o jogo, a turma responde e o ranking evolui em tempo real.</li>
          </ul>
        </article>

        <article className="home-panel">
          <h2>Orientacoes gerais</h2>
          <p>Alguns cuidados simples ajudam a deixar a experiencia mais segura e organizada.</p>
          <ul>
            <li>Revise o quiz antes de abrir a sala para evitar ajustes durante a aplicacao.</li>
            <li>Peca que os alunos confirmem o nome antes de entrar no ranking.</li>
            <li>Mantenha conexao estavel para acompanhar respostas e classificacao ao vivo.</li>
            <li>Ao final, exporte o relatorio para registro e acompanhamento pedagogico.</li>
          </ul>
        </article>

        <article className="home-panel">
          <h2>Destaques da plataforma</h2>
          <p>O LB Conexao Quiz foi desenhado para parecer produto pronto, sem perder simplicidade no uso.</p>
          <ul>
            <li>Entrada por PIN e QR Code com navegacao objetiva.</li>
            <li>Bancos de perguntas reutilizaveis com edicao de conteudo.</li>
            <li>Ranking ao vivo para aumentar participacao e ritmo da turma.</li>
            <li>Relatorio final exportavel para analise dos resultados.</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
