import React, { useEffect, useState, type FormEvent } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { api, getToken, setToken, type Booking, type Location, type Room, type User } from './api';
import './style.css';

function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  function reload() {
    api<T>(path).then(setData).catch((e: Error) => setError(e.message));
  }
  useEffect(() => { reload(); }, [path]);
  return { data, error, reload };
}
function Layout() {
  return <>
    <header>
      <NavLink className="brand" to="/">◈ SpaceBook</NavLink>
      <nav>
        <NavLink to="/">Каталог</NavLink>
        <NavLink to="/account">Мои бронирования</NavLink>
        <NavLink to="/admin">Администрирование</NavLink>
        <NavLink to="/login">Войти</NavLink>
      </nav>
    </header>
    <Routes>
      <Route path="/" element={<Catalog />} />
      <Route path="/rooms/:roomId" element={<RoomPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/account" element={<Account />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    <footer>SpaceBook • Учебный проект</footer>
  </>;
}
function Catalog() {
  const { data: rooms, error } = useLoad<Room[]>('/rooms');
  const { data: locations } = useLoad<Location[]>('/locations');
  return <main>
    <div className="hero">
      <p className="eyebrow">Платформа бронирования</p>
      <h1>Пространство для ваших лучших идей</h1>
      <p>Выбирайте переговорные и рабочие места для продуктивных встреч.</p>
    </div>
    <h2>Доступные пространства</h2>
    {error && <p className="error">{error}</p>}
    <div className="grid">
      {rooms?.filter(r => r.is_active).map(r =>
        <NavLink to={'/rooms/' + r.id} className="card" key={r.id}>
          <div className="card-image">{r.type === 'meeting_room' ? '▧' : '◫'}</div>
          <div className="card-body">
            <span className="tag">{r.type === 'meeting_room' ? 'Переговорная' : 'Рабочее место'}</span>
            <h3>{r.name}</h3>
            <p>{locations?.find(l => l.id === r.location_id)?.name ?? 'Коворкинг'}</p>
            <div className="card-bottom"><span>До {r.capacity} чел.</span><b>Подробнее →</b></div>
          </div>
        </NavLink>
      )}
    </div>
    {rooms?.length === 0 && <p>Помещений пока нет.</p>}
  </main>;
}
function RoomPage() {
  const { roomId } = useParams();
  const { data: room, error } = useLoad<Room>('/rooms/' + roomId);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  async function book(e: FormEvent) {
    e.preventDefault();
    if (!getToken()) { navigate('/login'); return; }
    try {
      await api<Booking>('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          start_time: new Date(start).toISOString(),
          end_time: new Date(end).toISOString()
        })
      });
      setMessage('Бронирование создано!');
    } catch (error) { setMessage((error as Error).message); }
  }
  return <main>
    <NavLink to="/">← К каталогу</NavLink>
    {error && <p className="error">{error}</p>}
    {room && <div className="details">
      <div>
        <div className="cover">▧</div>
        <span className="tag">{room.type === 'meeting_room' ? 'Переговорная' : 'Рабочее место'}</span>
        <h1>{room.name}</h1>
        <p>{room.description || 'Комфортное пространство для работы и встреч.'}</p>
        <p>Вместимость: {room.capacity} чел.</p>
      </div>
      <form className="panel" onSubmit={book}>
        <h2>Забронировать</h2>
        <label>Начало<input required type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label>Окончание<input required type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></label>
        <button>Подтвердить бронирование</button>
        {message && <p role="status">{message}</p>}
      </form>
    </div>}
  </main>;
}
function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const response = await api<{ access_token: string }>('/auth/login', {
        method: 'POST', body: JSON.stringify({ email, password })
      });
      setToken(response.access_token);
      navigate('/account');
    } catch (err) { setError((err as Error).message); }
  }
  return <main><form className="panel auth" onSubmit={submit}>
    <h1>Вход</h1>
    <label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label>Пароль<input required type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
    <button>Войти</button>
    {error && <p className="error">{error}</p>}
    <p>Нет аккаунта? <NavLink to="/register">Зарегистрироваться</NavLink></p>
  </form></main>;
}
function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/auth/register', {
        method: 'POST', body: JSON.stringify({ email, password, full_name: fullName })
      });
      navigate('/login');
    } catch (err) { setError((err as Error).message); }
  }
  return <main><form className="panel auth" onSubmit={submit}>
    <h1>Регистрация</h1>
    <label>Ваше имя<input required minLength={2} value={fullName} onChange={e => setFullName(e.target.value)} /></label>
    <label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label>Пароль<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
    <button>Создать аккаунт</button>
    {error && <p className="error">{error}</p>}
  </form></main>;
}
function Account() {
  const navigate = useNavigate();
  const { data: user, error } = useLoad<User>('/users/me');
  const { data: bookings, reload } = useLoad<Booking[]>('/bookings/me');
  const { data: rooms } = useLoad<Room[]>('/rooms');
  async function cancel(id: string) {
    try {
      await api('/bookings/' + id + '/cancel', { method: 'POST' });
      reload();
    } catch (err) { alert((err as Error).message); }
  }
  return <main>
    <div className="row"><div>
      <p className="eyebrow">Личный кабинет</p>
      <h1>Мои бронирования</h1>
      <p>{user?.full_name} · {user?.email}</p>
    </div><button className="secondary" onClick={() => { setToken(null); navigate('/login'); }}>Выйти</button></div>
    {error && <p className="error">Войдите, чтобы увидеть бронирования.</p>}
    {bookings?.map(b => <div className="booking" key={b.id}>
      <div><h3>{rooms?.find(r => r.id === b.room_id)?.name || 'Помещение'}</h3>
        <p>{new Date(b.start_time).toLocaleString('ru-RU')} — {new Date(b.end_time).toLocaleString('ru-RU')}</p></div>
      <div><span className="tag">{b.status === 'confirmed' ? 'Подтверждено' : 'Отменено'}</span>
        {b.status === 'confirmed' && <button className="secondary" onClick={() => cancel(b.id)}>Отменить</button>}</div>
    </div>)}
    {bookings?.length === 0 && <p>У вас пока нет бронирований.</p>}
  </main>;
}
function Admin() {
  const { data: user } = useLoad<User>('/users/me');
  const { data: locations, reload: refreshLocations } = useLoad<Location[]>('/locations');
  const { data: rooms, reload: refreshRooms } = useLoad<Room[]>('/rooms');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [roomName, setRoomName] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [error, setError] = useState('');
  async function addLocation(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/locations', { method: 'POST', body: JSON.stringify({ name, address, city }) });
      setName(''); refreshLocations();
    } catch (err) { setError((err as Error).message); }
  }
  async function addRoom(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/rooms', {
        method: 'POST',
        body: JSON.stringify({ location_id: location, name: roomName, type: 'meeting_room', capacity, is_active: true })
      });
      setRoomName(''); refreshRooms();
    } catch (err) { setError((err as Error).message); }
  }
  if (!user) return <main><h1>Панель администратора</h1><p>Войдите с правами администратора.</p></main>;
  if (user.role !== 'admin') return <main><h1>Доступ запрещён</h1><p>Необходима роль администратора.</p></main>;
  return <main>
    <p className="eyebrow">Управление</p>
    <h1>Панель администратора</h1>
    <div className="stats">
      <div className="panel"><h2>{locations?.length || 0}</h2>Локаций</div>
      <div className="panel"><h2>{rooms?.length || 0}</h2>Помещений</div>
    </div>
    {error && <p className="error">{error}</p>}
    <div className="grid two">
      <form className="panel" onSubmit={addLocation}>
        <h2>Добавить коворкинг</h2>
        <label>Название<input required value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Адрес<input required value={address} onChange={e => setAddress(e.target.value)} /></label>
        <label>Город<input required value={city} onChange={e => setCity(e.target.value)} /></label>
        <button>Добавить</button>
      </form>
      <form className="panel" onSubmit={addRoom}>
        <h2>Добавить помещение</h2>
        <label>Локация<select required value={location} onChange={e => setLocation(e.target.value)}>
          <option value="">Выберите</option>
          {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select></label>
        <label>Название<input required value={roomName} onChange={e => setRoomName(e.target.value)} /></label>
        <label>Вместимость<input required type="number" min={1} value={capacity} onChange={e => setCapacity(Number(e.target.value))} /></label>
        <button>Добавить</button>
      </form>
    </div>
  </main>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><Layout /></BrowserRouter></React.StrictMode>
);
