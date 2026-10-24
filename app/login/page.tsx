'use client';
import { useState, type FormEvent } from 'react';
export default function Login() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: data.get('username'), password: data.get('password') }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Не удалось войти. Проверьте адрес приложения.');
      }
      window.location.assign('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login_page">
      <form className="login_card" onSubmit={submit}>
        <a className="login_brand" href="/">
          Bill Hub<span>.</span>
        </a>
        <h1>Ваш домашний кабинет</h1>
        <p>Войдите, чтобы сохранить показания и увидеть историю.</p>
        <label>
          Логин
          <input
            name="username"
            autoComplete="username"
            required
            defaultValue="admin"
            maxLength={80}
          />
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary_button" disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
        <a href="/" className="text_button">
          Вернуться на главную
        </a>
      </form>
    </main>
  );
}
