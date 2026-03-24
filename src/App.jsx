import { startTransition, useEffect, useState } from 'react';
import HomePage from './components/HomePage.jsx';
import ProfessorApp from './components/ProfessorApp.jsx';
import PlayerApp from './components/PlayerApp.jsx';
import { getAppPath, getQueryRoute, pushRoute, replaceRoute } from './lib/helpers.js';

function useFeedback() {
  const [loadingMessage, setLoadingMessage] = useState('');
  const [toastData, setToastData] = useState({ visible: false, message: '', type: 'ok' });

  useEffect(() => {
    if (!toastData.visible) return undefined;
    const timeout = window.setTimeout(() => {
      setToastData((prev) => ({ ...prev, visible: false }));
    }, 3000);
    return () => window.clearTimeout(timeout);
  }, [toastData]);

  return {
    loadingMessage,
    setLoadingMessage,
    toast(message, type = 'ok') {
      setToastData({ visible: true, message, type });
    },
    toastData,
  };
}

export default function App() {
  const [route, setRoute] = useState(() => getQueryRoute());
  const feedback = useFeedback();

  useEffect(() => {
    const onPopState = () => setRoute(getQueryRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const expectedPath = getAppPath();
    if (window.location.pathname !== expectedPath) {
      replaceRoute(route.view, route.pin);
    }
  }, [route]);

  useEffect(() => {
    document.body.classList.add('app-light');
    document.body.classList.add('home-body');
    document.body.dataset.route = route.view;
    return () => {
      document.body.classList.remove('app-light');
      document.body.classList.remove('home-body');
      delete document.body.dataset.route;
    };
  }, [route.view]);

  function navigate(view, pin = '') {
    startTransition(() => {
      pushRoute(view, pin);
      setRoute({ view, pin });
    });
  }

  return (
    <>
      <div className="bg-orbs">
        <div className="orb orb1"></div>
        <div className="orb orb2"></div>
        <div className="orb orb3"></div>
      </div>

      {route.view === 'home' && <HomePage navigate={navigate} />}
      {route.view === 'professor' && <ProfessorApp navigate={navigate} feedback={feedback} />}
      {route.view === 'aluno' && <PlayerApp navigate={navigate} feedback={feedback} initialPin={route.pin} />}

      <div className={`ovl ${feedback.loadingMessage ? 'on' : ''}`}>
        <div className="spin"></div>
        <p>{feedback.loadingMessage || 'Aguarde...'}</p>
      </div>

      <div className={`tst ${feedback.toastData.visible ? 'on' : ''} ${feedback.toastData.type || 'ok'}`}>
        {feedback.toastData.message}
      </div>
    </>
  );
}
