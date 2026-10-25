import React, { useEffect, useState, type FormEvent } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { api, getToken, setToken, type Booking, type Location, type Room, type User, type Page, type Amenity, type AdminStats, imageUrl, uploadRoomImage } from './api';
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
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [roomType, setRoomType] = useState('');
  const [capacity, setCapacity] = useState('');
  const [amenity, setAmenity] = useState('');
  const [page, setPage] = useState(1);
  const [submitted, setSubmitted] = useState({ q: '', city: '', roomType: '', capacity: '', amenity: '' });
  const params = new URLSearchParams();
  if (submitted.q) params.set('q', submitted.q);
  if (submitted.city) params.set('city', submitted.city);
  if (submitted.roomType) params.set('room_type', submitted.roomType);
  if (submitted.capacity) params.set('capacity_min', submitted.capacity);
  if (submitted.amenity) params.set('amenity_id', submitted.amenity);
  params.set('page', String(page));
  params.set('page_size', '6');
  const { data: results, error } = useLoad<Page<Room>>('/catalog/rooms?' + params.toString());
  const { data: locations } = useLoad<Location[]>('/locations');
  const { data: amenities } = useLoad<Amenity[]>('/amenities');
  const cities = Array.from(new Set((locations || []).map(l => l.city))).sort();
  function applyFilters(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setSubmitted({ q: q.trim(), city, roomType, capacity, amenity });
  }
  function clearFilters() {
    setQ(''); setCity(''); setRoomType(''); setCapacity(''); setAmenity(''); setPage(1);
    setSubmitted({ q: '', city: '', roomType: '', capacity: '', amenity: '' });
  }
  return <main>
    <div className="hero">
      <p className="eyebrow">Платформа бронирования</p>
      <h1>Пространство для ваших лучших идей</h1>
      <p>Выбирайте переговорные и рабочие места для продуктивных встреч.</p>
    </div>
    <h2>Найдите идеальное пространство</h2>
    <form onSubmit={applyFilters}>
      <div className="filters">
        <label>Поиск<input placeholder="Название или описание" value={q} onChange={e => setQ(e.target.value)} /></label>
        <label>Город<select value={city} onChange={e => setCity(e.target.value)}>
          <option value="">Все города</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select></label>
        <label>Тип<select value={roomType} onChange={e => setRoomType(e.target.value)}>
          <option value="">Все типы</option><option value="meeting_room">Переговорные</option><option value="workspace">Рабочие места</option>
        </select></label>
        <label>Минимум человек<input type="number" min={1} value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="Любая" /></label>
        <label>Удобство<select value={amenity} onChange={e => setAmenity(e.target.value)}>
          <option value="">Любое</option>{amenities?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select></label>
      </div>
      <div className="filter-actions"><button type="submit">Найти помещения</button><button type="button" className="secondary" onClick={clearFilters}>Сбросить</button>
        <span className="muted">Найдено: {results?.total ?? '…'}</span></div>
    </form>
    {error && <p className="error">{error}</p>}
    <div className="grid">
      {results?.items.map(r => <NavLink to={'/rooms/' + r.id} className="card" key={r.id}>
        <div className={'card-image' + (r.image_url ? ' has-image' : '')}>
          {r.image_url ? <img className="room-photo" src={imageUrl(r.image_url) || ''} alt={r.name} /> : (r.type === 'meeting_room' ? '▧' : '◫')}
        </div>
        <div className="card-body">
          <span className="tag">{r.type === 'meeting_room' ? 'Переговорная' : 'Рабочее место'}</span>
          <h3>{r.name}</h3>
          <p>{locations?.find(l => l.id === r.location_id)?.name ?? 'Коворкинг'}</p>
          <div className="card-bottom"><span>До {r.capacity} чел.</span><b>Подробнее →</b></div>
        </div>
      </NavLink>)}
    </div>
    {results && results.items.length === 0 && <p>Помещений по выбранным условиям нет. Попробуйте изменить фильтры.</p>}
    {results && results.pages > 1 && <div className="pagination">
      <button className="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Назад</button>
      <span>Страница {results.page} из {results.pages}</span>
      <button className="secondary" disabled={page >= results.pages} onClick={() => setPage(p => p + 1)}>Вперёд →</button>
    </div>}
  </main>;
}
function RoomPage() {
  const { roomId } = useParams();
  const { data: room, error } = useLoad<Room>('/rooms/' + roomId);
  const { data: amenities } = useLoad<Amenity[]>('/rooms/' + roomId + '/amenities');
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
      setMessage('Бронирование создано! Оно уже в личном кабинете.');
    } catch (err) { setMessage((err as Error).message); }
  }
  return <main>
    <NavLink to="/">← К каталогу</NavLink>
    {error && <p className="error">{error}</p>}
    {room && <div className="details">
      <div>
        <div className="cover">{room.image_url
          ? <img className="room-photo" src={imageUrl(room.image_url) || ''} alt={room.name} />
          : '▧'}</div>
        <h1>{room.name}</h1>
        <span className="tag">{room.type === 'meeting_room' ? 'Переговорная' : 'Рабочее место'}</span>
        <p>{room.description || 'Комфортное пространство для работы и встреч.'}</p>
        <p>Вместимость: {room.capacity} чел.</p>
        <p><strong>Удобства:</strong> {amenities?.map(a => a.name).join(', ') || 'Не указаны'}</p>
      </div>
      <form className="panel" onSubmit={book}>
        <h2>Забронировать</h2>
        <label>Начало<input required type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label>Окончание<input required type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></label>
        <button>Подтвердить бронирование</button>
        {message && <p role="status">{message}</p>}
        <p className="muted">При пересечении с существующей бронью сервер отклонит запрос.</p>
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
  const { data: user, error, reload: reloadUser } = useLoad<User>('/users/me');
  const { data: bookings, reload } = useLoad<Booking[]>('/bookings/me');
  const { data: rooms } = useLoad<Room[]>('/rooms');
  const [name, setName] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [status, setStatus] = useState('all');
  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/users/me', { method: 'PATCH', body: JSON.stringify({ full_name: name }) });
      reloadUser(); setEditMessage('Имя обновлено');
    } catch (err) { setEditMessage((err as Error).message); }
  }
  async function cancel(id: string) {
    if (!confirm('Отменить бронирование?')) return;
    try {
      await api('/bookings/' + id + '/cancel', { method: 'POST' });
      reload();
    } catch (err) { alert((err as Error).message); }
  }
  const shown = bookings?.filter(b => status === 'all' || b.status === status);
  return <main>
    <div className="row"><div>
      <p className="eyebrow">Личный кабинет</p><h1>Мои бронирования</h1>
      <p>{user?.full_name} · {user?.email}</p>
    </div><button className="secondary" onClick={() => { setToken(null); navigate('/login'); }}>Выйти</button></div>
    {error && <p className="error">Войдите, чтобы увидеть бронирования.</p>}
    {user && <section className="panel admin-section">
      <h2>Настройки профиля</h2>
      <form className="form-inline" onSubmit={saveProfile}>
        <label>Имя<input required minLength={2} value={name} placeholder={user.full_name} onChange={e => setName(e.target.value)} /></label>
        <button disabled={!name.trim()}>Сохранить имя</button>
      </form>
      {editMessage && <p role="status">{editMessage}</p>}
    </section>}
    <section className="admin-section">
      <div className="row"><h2>История бронирований</h2>
        <label>Статус<select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">Все</option><option value="confirmed">Подтверждённые</option><option value="cancelled">Отменённые</option>
        </select></label>
      </div>
      {shown?.map(b => <div className="booking" key={b.id}>
        <div><h3>{rooms?.find(r => r.id === b.room_id)?.name || 'Помещение'}</h3>
          <p>{new Date(b.start_time).toLocaleString('ru-RU')} — {new Date(b.end_time).toLocaleString('ru-RU')}</p></div>
        <div><span className="tag">{b.status === 'confirmed' ? 'Подтверждено' : 'Отменено'}</span>
          {b.status === 'confirmed' && <button className="secondary" onClick={() => cancel(b.id)}>Отменить</button>}</div>
      </div>)}
      {shown?.length === 0 && <p>Бронирований с таким статусом пока нет.</p>}
    </section>
  </main>;
}
function Admin() {
  const { data: user } = useLoad<User>('/users/me');
  const { data: locations, reload: refreshLocations } = useLoad<Location[]>('/locations');
  const { data: rooms, reload: refreshRooms } = useLoad<Room[]>('/rooms');
  const { data: stats, reload: refreshStats } = useLoad<AdminStats>('/admin/stats');
  const { data: users, reload: refreshUsers } = useLoad<User[]>('/admin/users');
  const { data: bookings } = useLoad<Booking[]>('/bookings');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [roomName, setRoomName] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  function done(text: string) { setError(''); setMessage(text); refreshLocations(); refreshRooms(); refreshStats(); refreshUsers(); }
  function failed(err: unknown) { setError((err as Error).message); setMessage(''); }
  async function addLocation(e: FormEvent) {
    e.preventDefault();
    try { await api('/locations', { method: 'POST', body: JSON.stringify({ name, address, city }) });
      setName(''); setAddress(''); setCity(''); done('Локация добавлена'); }
    catch (err) { failed(err); }
  }
  async function addRoom(e: FormEvent) {
    e.preventDefault();
    try { await api('/rooms', {
      method: 'POST',
      body: JSON.stringify({ location_id: location, name: roomName, type: 'meeting_room', capacity, is_active: true })
    }); setRoomName(''); done('Помещение добавлено'); }
    catch (err) { failed(err); }
  }
  async function renameRoom(room: Room) {
    const nextName = prompt('Новое название помещения', room.name);
    if (!nextName || nextName === room.name) return;
    try { await api('/rooms/' + room.id, {
      method: 'PUT', body: JSON.stringify({ ...room, name: nextName })
    }); done('Помещение изменено'); }
    catch (err) { failed(err); }
  }
  async function toggleRoom(room: Room) {
    try { await api('/rooms/' + room.id, {
      method: 'PUT', body: JSON.stringify({ ...room, is_active: !room.is_active })
    }); done(room.is_active ? 'Помещение скрыто' : 'Помещение снова активно'); }
    catch (err) { failed(err); }
  }
  async function removeRoom(room: Room) {
    if (!confirm('Удалить помещение «' + room.name + '»?')) return;
    try { await api('/rooms/' + room.id, { method: 'DELETE' }); done('Помещение удалено'); }
    catch (err) { failed(err); }
  }
  async function uploadImage(room: Room, file: File | undefined) {
    if (!file) return;
    try { await uploadRoomImage(room.id, file); done('Фото загружено'); }
    catch (err) { failed(err); }
  }
  async function toggleUser(target: User) {
    if (!confirm((target.is_blocked ? 'Разблокировать' : 'Заблокировать') + ' пользователя ' + target.email + '?')) return;
    try { await api('/admin/users/' + target.id + '/block?blocked=' + (!target.is_blocked), { method: 'PATCH' }); done('Статус пользователя обновлён'); }
    catch (err) { failed(err); }
  }
  if (!user) return <main><h1>Панель администратора</h1><p>Войдите с правами администратора.</p></main>;
  if (user.role !== 'admin') return <main><h1>Доступ запрещён</h1><p>Необходима роль администратора.</p></main>;
  return <main>
    <p className="eyebrow">Управление платформой</p><h1>Панель администратора</h1>
    <div className="stats">
      {[
        ['Пользователей', stats?.users],
        ['Коворкингов', stats?.locations],
        ['Помещений', stats?.rooms],
        ['Активных броней', stats?.confirmed_bookings],
        ['Отменённых броней', stats?.cancelled_bookings]
      ].map(([label, val]) => <div className="panel" key={String(label)}><h2>{val ?? '…'}</h2>{label}</div>)}
    </div>
    {error && <p className="error">{error}</p>}
    {message && <p className="notice">{message}</p>}
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
    <section className="panel admin-section"><h2>Управление помещениями</h2>
      <table className="admin-table"><thead><tr><th>Помещение</th><th>Статус</th><th>Фото</th><th>Действия</th></tr></thead><tbody>
        {rooms?.map(room => <tr key={room.id}>
          <td>{room.name}<div className="muted">До {room.capacity} чел.</div></td>
          <td>{room.is_active ? 'Активно' : 'Скрыто'}</td>
          <td><input aria-label={'Фото для ' + room.name} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => uploadImage(room, e.target.files?.[0])}/></td>
          <td><button className="secondary" onClick={() => renameRoom(room)}>Название</button>{' '}
            <button className="secondary" onClick={() => toggleRoom(room)}>{room.is_active ? 'Скрыть' : 'Показать'}</button>{' '}
            <button className="secondary" onClick={() => removeRoom(room)}>Удалить</button></td>
        </tr>)}
      </tbody></table>
    </section>
    <section className="panel admin-section"><h2>Пользователи</h2>
      <table className="admin-table"><thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Доступ</th></tr></thead><tbody>
        {users?.map(target => <tr key={target.id}>
          <td>{target.full_name}</td><td>{target.email}</td><td>{target.role}</td>
          <td><button className="secondary" disabled={target.id === user.id} onClick={() => toggleUser(target)}>
            {target.is_blocked ? 'Разблокировать' : 'Заблокировать'}</button></td>
        </tr>)}
      </tbody></table>
    </section>
    <section className="panel admin-section"><h2>Последние бронирования</h2>
      <table className="admin-table"><thead><tr><th>Помещение</th><th>Начало</th><th>Статус</th></tr></thead><tbody>
        {bookings?.slice(0, 10).map(b => <tr key={b.id}>
          <td>{rooms?.find(r => r.id === b.room_id)?.name ?? b.room_id}</td>
          <td>{new Date(b.start_time).toLocaleString('ru-RU')}</td><td>{b.status}</td>
        </tr>)}
      </tbody></table>
    </section>
  </main>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><Layout /></BrowserRouter></React.StrictMode>
);
