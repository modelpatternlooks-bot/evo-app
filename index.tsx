import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Chat, Type, LiveServerMessage, Modality } from "@google/genai";

// --- AI Initialization ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helper Functions ---
const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
};

const getNotificationIcon = (type) => {
    switch (type) {
        case 'goal': return '🎯';
        case 'habit': return '🌱';
        case 'workshop': return '🔬';
        case 'welcome': return '👋';
        default: return '🔔';
    }
};

// --- Widget Components ---

const NotificationPopup = ({ notification, onRemove }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const exitTimer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => onRemove(notification.id), 500); // Allow 500ms for fade-out animation
        }, 6000); // Notification stays for 6 seconds

        return () => clearTimeout(exitTimer);
    }, []);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => onRemove(notification.id), 500);
    };

    return (
        <div className={`notification-popup ${isExiting ? 'exit' : 'enter'}`}>
            <span className="notification-popup-icon">{getNotificationIcon(notification.type)}</span>
            <p className="notification-popup-text">{notification.text}</p>
            <button onClick={handleClose} className="notification-popup-close" aria-label="Close notification">&times;</button>
        </div>
    );
};


const WelcomeWidget = () => (
  <div className="widget">
    <div className="widget-header">
      <h2>ยินดีต้อนรับสู่ EvoApp</h2>
    </div>
    <div className="widget-content">
      <p>นี่คือ Dashboard ต้นแบบของคุณ เริ่มต้นจัดการทุกอย่างได้จากที่นี่</p>
    </div>
  </div>
);

const ToDoWidget = ({ todos, setTodos, speakingText, handleGlobalSpeak }) => {
  const [inputValue, setInputValue] = useState('');

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleAddTodo = (e) => {
    e.preventDefault();
    if (inputValue.trim() === '') return;
    setTodos([
      ...todos,
      { id: Date.now(), text: inputValue, completed: false },
    ]);
    setInputValue('');
  };

  const toggleTodo = (id) => {
    setTodos(
      todos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  return (
    <div className="widget">
      <div className="widget-header">
        <h2>รายการสิ่งที่ต้องทำ (To-Do)</h2>
      </div>
      <div className="widget-content">
        <form className="todo-form" onSubmit={handleAddTodo}>
          <input
            type="text"
            className="todo-input"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="เพิ่มรายการใหม่..."
            aria-label="เพิ่มรายการสิ่งที่ต้องทำใหม่"
          />
          <button type="submit" className="todo-button" aria-label="เพิ่ม">เพิ่ม</button>
        </form>
        <ul className="todo-list">
          {todos.map(todo => (
            <li key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                aria-label={`ทำเครื่องหมายว่า ${todo.text} เสร็จสิ้น`}
              />
              <span>{todo.text}</span>
              <div className="todo-item-actions">
                  <button
                    onClick={() => handleGlobalSpeak(todo.text)}
                    className={`speak-button ${speakingText === todo.text ? 'speaking' : ''}`}
                    aria-label={speakingText === todo.text ? `หยุดฟัง ${todo.text}` : `ฟัง ${todo.text}`}
                  >
                    {speakingText === todo.text ? '⏹️' : '🔊'}
                  </button>
                  <button onClick={() => deleteTodo(todo.id)} className="delete-button" aria-label={`ลบ ${todo.text}`}>
                    &times;
                  </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const NotesWidget = ({ notes, setNotes, speakingText, handleGlobalSpeak }) => {
  return (
    <div className="widget">
      <div className="widget-header">
        <h2>บันทึกย่อ (Notes)</h2>
        <button
            onClick={() => handleGlobalSpeak(notes)}
            className={`speak-button header-speak-button ${speakingText === notes ? 'speaking' : ''}`}
            aria-label={speakingText === notes ? "หยุดฟังบันทึกย่อ" : "ฟังบันทึกย่อ"}
            disabled={!notes}
          >
            {speakingText === notes ? '⏹️' : '🔊'}
        </button>
      </div>
      <div className="widget-content">
        <textarea
          className="notes-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="จดบันทึกของคุณที่นี่..."
          aria-label="พื้นที่สำหรับบันทึกย่อ"
        />
      </div>
    </div>
  );
};

const CalendarWidget = ({ goals, events, setEvents, speakingText, handleGlobalSpeak }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [newEventTitle, setNewEventTitle] = useState('');

    const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const dayNames = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleDateClick = (date) => {
        setSelectedDate(date);
        setIsModalOpen(true);
    };

    const handleAddEvent = (e) => {
        e.preventDefault();
        if (newEventTitle.trim() === '') return;
        const newEvent = {
            id: Date.now(),
            date: selectedDate.toISOString().split('T')[0],
            title: newEventTitle,
        };
        setEvents([...events, newEvent]);
        setNewEventTitle('');
    };

    const handleDeleteEvent = (eventId) => {
        setEvents(events.filter(event => event.id !== eventId));
    };

    const renderHeader = () => (
        <div className="calendar-header">
            <button onClick={handlePrevMonth} aria-label="เดือนก่อนหน้า">&lt;</button>
            <h2>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear() + 543}</h2>
            <button onClick={handleNextMonth} aria-label="เดือนถัดไป">&gt;</button>
        </div>
    );

    const renderDays = () => (
        <div className="day-names">
            {dayNames.map(day => <div key={day}>{day}</div>)}
        </div>
    );

    const renderCells = () => {
        const month = currentDate.getMonth();
        const year = currentDate.getFullYear();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const cells = [];
        let day = 1;

        // Create a 6x7 grid for the calendar
        for (let i = 0; i < 6; i++) {
            if (day > daysInMonth) break;
            for (let j = 0; j < 7; j++) {
                if (i === 0 && j < firstDayOfMonth) {
                    cells.push(<div className="day-cell other-month" key={`prev-${j}`}></div>);
                } else if (day > daysInMonth) {
                    cells.push(<div className="day-cell other-month" key={`next-${j}`}></div>);
                } else {
                    const cellDate = new Date(year, month, day);
                    const cellDateString = cellDate.toISOString().split('T')[0];
                    const today = new Date();
                    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

                    const dayEvents = events.filter(e => e.date === cellDateString);
                    const dayGoals = goals.filter(g => g.targetDate === cellDateString);

                    cells.push(
                        <div className={`day-cell ${isToday ? 'today' : ''}`} key={day} onClick={() => handleDateClick(cellDate)} role="button" tabIndex={0}>
                            <span className="day-number">{day}</span>
                            <div className="event-indicators">
                                {dayEvents.map(e => <div key={`evt-${e.id}`} className="event-dot" title={e.title}></div>)}
                                {dayGoals.map(g => <div key={`goal-${g.id}`} className="goal-dot" title={g.title}>🎯</div>)}
                            </div>
                        </div>
                    );
                    day++;
                }
            }
        }
        return <div className="calendar-grid">{cells}</div>;
    };

    const selectedDateString = selectedDate ? selectedDate.toISOString().split('T')[0] : '';
    const eventsForSelectedDate = events.filter(e => e.date === selectedDateString);
    const goalsForSelectedDate = goals.filter(g => g.targetDate === selectedDateString);

    return (
        <div className="widget calendar-widget">
            <div className="widget-header">
                <h2>🗓️ ปฏิทิน (Calendar)</h2>
            </div>
            <div className="widget-content">
                {renderHeader()}
                {renderDays()}
                {renderCells()}
            </div>

            {isModalOpen && selectedDate && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>กิจกรรมสำหรับวันที่ {selectedDate.toLocaleDateString('th-TH-u-nu-thai')}</h3>
                        <ul className="events-list">
                            {goalsForSelectedDate.map(goal => (
                               <li key={`goal-${goal.id}`} className="goal-event">
                                   <span>🎯 {goal.title} (เป้าหมาย)</span>
                                   <button
                                     onClick={() => handleGlobalSpeak(goal.title)}
                                     className={`speak-button ${speakingText === goal.title ? 'speaking' : ''}`}
                                     aria-label={speakingText === goal.title ? `หยุดฟัง ${goal.title}` : `ฟัง ${goal.title}`}>
                                     {speakingText === goal.title ? '⏹️' : '🔊'}
                                   </button>
                               </li>
                            ))}
                             {eventsForSelectedDate.map(event => (
                               <li key={event.id}>
                                   <span>{event.title}</span>
                                   <div className="event-actions">
                                      <button
                                        onClick={() => handleGlobalSpeak(event.title)}
                                        className={`speak-button ${speakingText === event.title ? 'speaking' : ''}`}
                                        aria-label={speakingText === event.title ? `หยุดฟัง ${event.title}` : `ฟัง ${event.title}`}>
                                        {speakingText === event.title ? '⏹️' : '🔊'}
                                      </button>
                                      <button onClick={() => handleDeleteEvent(event.id)} className="delete-button" aria-label={`ลบ ${event.title}`}>&times;</button>
                                   </div>
                               </li>
                            ))}
                            {(eventsForSelectedDate.length === 0 && goalsForSelectedDate.length === 0) && (
                                <p className="no-events-message">ไม่มีกิจกรรมสำหรับวันนี้</p>
                            )}
                        </ul>
                         <form className="event-form" onSubmit={handleAddEvent}>
                            <input
                                type="text"
                                value={newEventTitle}
                                onChange={(e) => setNewEventTitle(e.target.value)}
                                placeholder="เพิ่มกิจกรรมใหม่..."
                                aria-label="ชื่อกิจกรรมใหม่"
                            />
                            <button type="submit">เพิ่ม</button>
                        </form>
                        <div className="modal-actions">
                            <button onClick={() => setIsModalOpen(false)}>ปิด</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


const AICoreMemoryWidget = ({ coreMemory, setCoreMemory, speakingText, handleGlobalSpeak }) => {
    return (
      <div className="widget ai-core-memory-widget">
        <div className="widget-header">
          <h2>📝 สมุดบันทึกความจำ AI</h2>
           <button
                onClick={() => handleGlobalSpeak(coreMemory)}
                className={`speak-button header-speak-button ${speakingText === coreMemory ? 'speaking' : ''}`}
                aria-label={speakingText === coreMemory ? "หยุดฟัง" : "ฟังบันทึกความจำ"}
                disabled={!coreMemory}
            >
              {speakingText === coreMemory ? '⏹️' : '🔊'}
          </button>
        </div>
        <div className="widget-content">
          <p className="core-memory-description">
            นี่คือชุดคำสั่งหลักและความทรงจำของ "Eva" ผู้ช่วย AI ของคุณ
            ข้อมูลในนี้จะถูกใช้เป็นแนวทางในการโต้ตอบเสมอ (ห้ามลบข้อมูลสำคัญ)
          </p>
          <textarea
            className="core-memory-textarea"
            value={coreMemory}
            onChange={(e) => setCoreMemory(e.target.value)}
            aria-label="พื้นที่สำหรับแก้ไขชุดคำสั่งหลักของ AI"
          />
        </div>
      </div>
    );
};

const WeatherWidget = ({ speakingText, handleGlobalSpeak }) => {
    const [weatherData, setWeatherData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCity, setSelectedCity] = useState('Bangkok');

    useEffect(() => {
        const fetchWeatherData = async () => {
            setLoading(true);
            setError(null);
            setWeatherData(null);

            // Simulate a network delay
            await new Promise(resolve => setTimeout(resolve, 800));

            try {
                // In a real app, this would be:
                // const response = await fetch(`https://api.weather.com/v1/city=${selectedCity}`);
                // if (!response.ok) throw new Error('Network response was not ok');
                // const data = await response.json();
                
                // --- Simulating API response ---
                let data;
                switch (selectedCity) {
                    case 'Bangkok':
                        data = { temp: 32, condition: 'มีเมฆบางส่วน', icon: '☁️' };
                        break;
                    case 'Chiang Mai':
                        data = { temp: 28, condition: 'แดดจัด', icon: '☀️' };
                        break;
                    case 'London':
                        data = { temp: 15, condition: 'ฝนตก', icon: '🌧️' };
                        break;
                    case 'Tokyo':
                        data = { temp: 22, condition: 'มีเมฆมาก', icon: '☁️' };
                        break;
                    default:
                        throw new Error("City not found");
                }
                // --- End Simulation ---

                setWeatherData(data);

            } catch (err) {
                setError('ไม่สามารถโหลดข้อมูลสภาพอากาศได้');
                console.error("Failed to fetch weather data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchWeatherData();
    }, [selectedCity]);


    const handleCityChange = (city) => {
        setSelectedCity(city);
    };
    
    const availableCities = ['Bangkok', 'Chiang Mai', 'London', 'Tokyo'];

    return (
        <div className="widget">
            <div className="widget-header">
                <h2>สภาพอากาศ (Weather)</h2>
            </div>
            <div className="widget-content weather-widget">
                <div className="city-selector">
                    {availableCities.map(city => (
                        <button
                            key={city}
                            className={selectedCity === city ? 'active' : ''}
                            onClick={() => handleCityChange(city)}
                        >
                            {city}
                        </button>
                    ))}
                </div>
                {loading && <div className="weather-loading">กำลังโหลด...</div>}
                
                {error && <div className="weather-error">⚠️ {error}</div>}

                {weatherData && !loading && !error && (
                    (() => {
                        const weatherSummary = `${selectedCity}, ${weatherData.temp} องศาเซลเซียส, ${weatherData.condition}`;
                        return (
                            <div className="weather-display">
                                <div className="weather-header-info">
                                    <div className="weather-location">{selectedCity}</div>
                                     <button
                                        onClick={() => handleGlobalSpeak(weatherSummary)}
                                        className={`speak-button weather-speak-button ${speakingText === weatherSummary ? 'speaking' : ''}`}
                                        aria-label={speakingText === weatherSummary ? 'หยุดฟัง' : 'ฟังพยากรณ์อากาศ'}
                                    >
                                        {speakingText === weatherSummary ? '⏹️' : '🔊'}
                                    </button>
                                </div>
                                <div className="weather-main">
                                    <div className="weather-icon">{weatherData.icon}</div>
                                    <div className="weather-info">
                                        <div className="weather-temp">{weatherData.temp}°C</div>
                                        <div className="weather-condition">{weatherData.condition}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()
                )}
            </div>
        </div>
    );
};

const ClockWidget = ({ time }) => {
    const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

    return (
        <div className="widget clock-widget">
            <div className="time-display">{time.toLocaleTimeString('th-TH', timeOptions)}</div>
            <div className="date-display">{time.toLocaleDateString('th-TH-u-nu-thai', dateOptions)}</div>
        </div>
    );
};

const GoalTrackingWidget = ({ goals, setGoals, todos, speakingText, handleGlobalSpeak }) => {
    const [newGoalTitle, setNewGoalTitle] = useState('');
    const [newGoalDate, setNewGoalDate] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedGoal, setSelectedGoal] = useState(null);
    const [linkedTodos, setLinkedTodos] = useState(new Set());

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState(null);


    const handleAddGoal = (e) => {
        e.preventDefault();
        if (newGoalTitle.trim() === '' || newGoalDate.trim() === '') return;
        const newGoal = {
            id: Date.now(),
            title: newGoalTitle,
            targetDate: newGoalDate,
            linkedTodoIds: [],
        };
        setGoals([...goals, newGoal]);
        setNewGoalTitle('');
        setNewGoalDate('');
    };

    const handleDeleteGoal = (goalId) => {
        setGoals(goals.filter(goal => goal.id !== goalId));
    };

    const openLinkModal = (goal) => {
        setSelectedGoal(goal);
        setLinkedTodos(new Set(goal.linkedTodoIds));
        setIsModalOpen(true);
    };
    
    const openEditModal = (goal) => {
        setEditingGoal({ ...goal });
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditingGoal(null);
    };
    
    const handleUpdateGoal = (e) => {
        e.preventDefault();
        if (!editingGoal || !editingGoal.title.trim() || !editingGoal.targetDate.trim()) return;
        setGoals(goals.map(goal => goal.id === editingGoal.id ? editingGoal : goal));
        closeEditModal();
    };

    const handleEditingGoalChange = (e) => {
        const { name, value } = e.target;
        setEditingGoal(prev => ({ ...prev, [name]: value }));
    };

    const handleToggleTodoLink = (todoId) => {
        setLinkedTodos(prev => {
            const newSet = new Set(prev);
            if (newSet.has(todoId)) {
                newSet.delete(todoId);
            } else {
                newSet.add(todoId);
            }
            return newSet;
        });
    };

    const handleSaveLinks = () => {
        setGoals(goals.map(goal =>
            goal.id === selectedGoal.id
                ? { ...goal, linkedTodoIds: Array.from(linkedTodos) }
                : goal
        ));
        setIsModalOpen(false);
        setSelectedGoal(null);
    };

    const calculateProgress = (goal) => {
        const relevantTodos = todos.filter(t => goal.linkedTodoIds.includes(t.id));
        if (relevantTodos.length === 0) return 0;
        const completedCount = relevantTodos.filter(t => t.completed).length;
        return (completedCount / relevantTodos.length) * 100;
    };

    const allLinkedTodoIds = goals.flatMap(g => g.linkedTodoIds);
    const unlinkedTodos = todos.filter(t => !allLinkedTodoIds.includes(t.id));

    const sortedGoals = [...goals].sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());

    return (
        <div className="widget goal-tracking-widget">
            <div className="widget-header">
                <h2>🎯 ติดตามเป้าหมาย (Goals)</h2>
            </div>
            <div className="widget-content">
                <ul className="goal-list">
                    {sortedGoals.map(goal => {
                        const progress = calculateProgress(goal);
                        const isCompleted = progress >= 100;
                        return (
                            <li key={goal.id} className={`goal-item ${isCompleted ? 'completed' : ''}`}>
                                <div className="goal-info">
                                    <span className="goal-title">
                                        {isCompleted && '✅ '}
                                        {goal.title}
                                    </span>
                                    <span className="goal-date">เป้าหมาย: {new Date(goal.targetDate).toLocaleDateString('th-TH')}</span>
                                </div>
                                <div className="progress-bar">
                                    <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                                    <span className="progress-bar-text">{Math.round(progress)}%</span>
                                </div>
                                <div className="goal-actions">
                                     <button
                                        onClick={() => handleGlobalSpeak(goal.title)}
                                        className={`speak-button ${speakingText === goal.title ? 'speaking' : ''}`}
                                        aria-label={speakingText === goal.title ? `หยุดฟัง ${goal.title}` : `ฟัง ${goal.title}`}>
                                        {speakingText === goal.title ? '⏹️' : '🔊'}
                                     </button>
                                      <button onClick={() => openEditModal(goal)} className="edit-button" aria-label={`แก้ไข ${goal.title}`}>
                                        ✏️
                                     </button>
                                     <button onClick={() => openLinkModal(goal)} className="link-button">
                                        🔗 เชื่อม To-Do
                                    </button>
                                    <button onClick={() => handleDeleteGoal(goal.id)} className="delete-button">&times;</button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
                <form className="goal-form" onSubmit={handleAddGoal}>
                    <input
                        type="text"
                        value={newGoalTitle}
                        onChange={(e) => setNewGoalTitle(e.target.value)}
                        placeholder="ชื่อเป้าหมายใหม่..."
                        aria-label="ชื่อเป้าหมายใหม่"
                    />
                    <input
                        type="date"
                        value={newGoalDate}
                        onChange={(e) => setNewGoalDate(e.target.value)}
                        aria-label="วันที่เป้าหมาย"
                    />
                    <button type="submit">เพิ่มเป้าหมาย</button>
                </form>
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>เชื่อม To-Do กับ: "{selectedGoal.title}"</h3>
                        <ul className="modal-todo-list">
                            {todos.filter(t => !allLinkedTodoIds.includes(t.id) || selectedGoal.linkedTodoIds.includes(t.id)).map(todo => (
                               <li key={todo.id}>
                                   <label>
                                       <input
                                           type="checkbox"
                                           checked={linkedTodos.has(todo.id)}
                                           onChange={() => handleToggleTodoLink(todo.id)}
                                       />
                                       {todo.text}
                                   </label>
                               </li>
                            ))}
                            {unlinkedTodos.length === 0 && !goals.find(g => g.id === selectedGoal.id)?.linkedTodoIds.length && (
                                <p className="no-todos-message">ไม่มี To-Do ที่ว่างให้เชื่อมโยง</p>
                            )}
                        </ul>
                        <div className="modal-actions">
                            <button onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
                            <button onClick={handleSaveLinks} className="primary">บันทึก</button>
                        </div>
                    </div>
                </div>
            )}
            
            {isEditModalOpen && editingGoal && (
                 <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>แก้ไขเป้าหมาย</h3>
                        <form className="goal-edit-form" onSubmit={handleUpdateGoal}>
                            <label htmlFor="goal-title-edit">ชื่อเป้าหมาย</label>
                            <input
                                id="goal-title-edit"
                                type="text"
                                name="title"
                                value={editingGoal.title}
                                onChange={handleEditingGoalChange}
                                required
                            />
                            <label htmlFor="goal-date-edit">วันที่เป้าหมาย</label>
                            <input
                                id="goal-date-edit"
                                type="date"
                                name="targetDate"
                                value={editingGoal.targetDate}
                                onChange={handleEditingGoalChange}
                                required
                            />
                             <div className="modal-actions">
                                <button type="button" onClick={closeEditModal}>ยกเลิก</button>
                                <button type="submit" className="primary">บันทึก</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const HabitTrackingWidget = ({ habits, setHabits, speakingText, handleGlobalSpeak }) => {
    const [newHabitName, setNewHabitName] = useState('');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfWeek = getStartOfWeek(today);

    const handleAddHabit = (e) => {
        e.preventDefault();
        if (newHabitName.trim() === '') return;
        const newHabit = {
            id: Date.now(),
            name: newHabitName,
            completedDates: [],
        };
        setHabits([...habits, newHabit]);
        setNewHabitName('');
    };

    const handleDeleteHabit = (habitId) => {
        setHabits(habits.filter(h => h.id !== habitId));
    };

    const toggleDateCompletion = (habitId, date) => {
        setHabits(habits.map(habit => {
            if (habit.id === habitId) {
                const dateString = date.toISOString().split('T')[0];
                const completed = new Set(habit.completedDates);
                if (completed.has(dateString)) {
                    completed.delete(dateString);
                } else {
                    completed.add(dateString);
                }
                return { ...habit, completedDates: Array.from(completed) };
            }
            return habit;
        }));
    };

    const calculateStreak = (completedDates) => {
        if (completedDates.length === 0) return 0;
        const sortedDates = completedDates.map(d => new Date(d)).sort((a, b) => b - a);
        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0,0,0,0);

        // Check if today is completed
        const todayStr = currentDate.toISOString().split('T')[0];
        const isTodayCompleted = sortedDates.some(d => d.toISOString().split('T')[0] === todayStr);

        // Check if yesterday is completed
        let yesterday = new Date();
        yesterday.setDate(currentDate.getDate() - 1);
        yesterday.setHours(0,0,0,0);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const isYesterdayCompleted = sortedDates.some(d => d.toISOString().split('T')[0] === yesterdayStr);

        // Streak only counts if today or yesterday is completed
        if (!isTodayCompleted && !isYesterdayCompleted) {
            return 0;
        }

        // Start counting streak from today
        let expectedDate = new Date();
        expectedDate.setHours(0,0,0,0);

        for (const d of sortedDates) {
            const dateStr = d.toISOString().split('T')[0];
            const expectedDateStr = expectedDate.toISOString().split('T')[0];
            if (dateStr === expectedDateStr) {
                streak++;
                expectedDate.setDate(expectedDate.getDate() - 1);
            } else {
                break; // Streak broken
            }
        }
        return streak;
    };


    const weekDays = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
    });

    return (
        <div className="widget habit-tracking-widget">
            <div className="widget-header">
                <h2>🌱 ติดตามนิสัย (Habits)</h2>
            </div>
            <div className="widget-content">
                <ul className="habit-list">
                    {habits.map(habit => (
                        <li key={habit.id} className="habit-item">
                            <div className="habit-info">
                                <div className="habit-name-streak">
                                    <span className="habit-name">{habit.name}</span>
                                    <span className="habit-streak">🔥 {calculateStreak(habit.completedDates)}</span>
                                </div>
                                <div className="habit-actions">
                                    <button
                                        onClick={() => handleGlobalSpeak(habit.name)}
                                        className={`speak-button ${speakingText === habit.name ? 'speaking' : ''}`}
                                        aria-label={speakingText === habit.name ? `หยุดฟัง ${habit.name}` : `ฟัง ${habit.name}`}>
                                        {speakingText === habit.name ? '⏹️' : '🔊'}
                                    </button>
                                    <button onClick={() => handleDeleteHabit(habit.id)} className="delete-button">&times;</button>
                                </div>
                            </div>
                            <div className="week-grid">
                                {weekDays.map((day, index) => {
                                    const dayString = day.toISOString().split('T')[0];
                                    const isCompleted = habit.completedDates.includes(dayString);
                                    const isFuture = day > today;
                                    const isToday = day.getTime() === today.getTime();

                                    return (
                                        <div key={index} className="day-cell-container">
                                            <span className="day-label">{day.toLocaleDateString('th-TH', { weekday: 'short' })}</span>
                                            <button
                                                className={`day-cell ${isCompleted ? 'completed' : ''} ${isToday ? 'today' : ''}`}
                                                onClick={() => !isFuture && toggleDateCompletion(habit.id, day)}
                                                disabled={isFuture}
                                                aria-label={`Mark ${habit.name} as ${isCompleted ? 'not completed' : 'completed'} for ${day.toLocaleDateString()}`}
                                            >
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </li>
                    ))}
                </ul>
                 <form className="habit-form" onSubmit={handleAddHabit}>
                    <input
                        type="text"
                        value={newHabitName}
                        onChange={(e) => setNewHabitName(e.target.value)}
                        placeholder="เพิ่มนิสัยใหม่..."
                        aria-label="ชื่อนิสัยใหม่"
                    />
                    <button type="submit">เพิ่ม</button>
                </form>
            </div>
        </div>
    );
};

const AIWorkshopWidget = ({ projects, setProjects, setTodos, todos, addNotification, speakingText, handleGlobalSpeak }) => {
    const [topic, setTopic] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuggesting, setIsSuggesting] = useState(null); // Tracks suggesting state per project
    const [error, setError] = useState('');
    const [expandedProjectId, setExpandedProjectId] = useState(null);
    const [viewModes, setViewModes] = useState({}); // e.g., { projectId: 'list' | 'mindmap' }

    const projectPlanSchema = {
      type: Type.OBJECT,
      properties: {
        projectName: {
          type: Type.STRING,
          description: "A concise, engaging name for the project based on the user's topic. Must be in Thai.",
        },
        summary: {
          type: Type.STRING,
          description: "A brief, one-paragraph summary of the project plan. Must be in Thai.",
        },
        steps: {
          type: Type.ARRAY,
          description: "A list of steps to complete the project.",
          items: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "A short, clear title for the step. Must be in Thai.",
              },
              description: {
                type: Type.STRING,
                description: "A one-sentence description of what the step involves. Must be in Thai.",
              },
              isActionable: {
                  type: Type.BOOLEAN,
                  description: "Set to true if this step is a concrete task that can be added to a to-do list, false if it's a heading, a general phase, or a concluding remark."
              }
            },
            required: ["title", "description", "isActionable"],
          },
        },
      },
      required: ["projectName", "summary", "steps"],
    };


    const handleStartProject = async (e) => {
        e.preventDefault();
        if (topic.trim() === '') return;
        
        setIsLoading(true);
        setError('');

        const prompt = `Based on the latest information from the web, generate a comprehensive project plan for the topic: "${topic}". Structure your response as a JSON object that conforms to the provided schema. The 'steps' should include both high-level phases (isActionable: false) and specific, concrete tasks (isActionable: true). The entire response, including all string values in the JSON, must be in Thai.`;

        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    tools: [{googleSearch: {}}],
                    responseMimeType: "application/json",
                    responseSchema: projectPlanSchema,
                },
            });
            
            const planData = JSON.parse(response.text);
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            
            const sources = groundingChunks
                .map(chunk => chunk.web)
                .filter(web => web && web.uri && web.title)
                .reduce((acc, current) => {
                    if (!acc.find(item => item.uri === current.uri)) {
                        acc.push(current);
                    }
                    return acc;
                }, []);

            const newProject = { 
                id: Date.now(),
                topic: topic,
                plan: planData, 
                sources: sources,
            };
            
            setProjects(prev => [newProject, ...prev]);
            setExpandedProjectId(newProject.id);
            addNotification(`โปรเจกต์ "${planData.projectName}" ของคุณได้ถูกสร้างขึ้นแล้ว!`, 'workshop');
            setTopic('');

        } catch (apiError) {
            console.error("AI Workshop generation failed:", apiError);
            setError("ขออภัยค่ะ มีปัญหาในการสร้างโปรเจกต์ โปรดตรวจสอบรูปแบบและลองอีกครั้ง");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDownload = (project) => {
        if (!project) return;

        let content = `หัวข้อ: ${project.topic}\n`;
        content += `ชื่อโปรเจกต์: ${project.plan.projectName}\n\n`;
        content += "============== สรุป ==============\n";
        content += `${project.plan.summary}\n\n`;
        content += "============== แผนงานโปรเจกต์ ==============\n\n";
        
        project.plan.steps.forEach(step => {
            content += `${step.isActionable ? '[ ]' : '###'} ${step.title}\n`;
            content += `- ${step.description}\n\n`;
        });


        if (project.sources && project.sources.length > 0) {
            content += "\n\n============== แหล่งข้อมูลที่ใช้ ==============\n\n";
            project.sources.forEach(source => {
                content += `- ${source.title}: ${source.uri}\n`;
            });
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `EvoApp_Project_${project.topic.replace(/\s/g, '_')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDeleteProject = (projectId) => {
        setProjects(projects.filter(p => p.id !== projectId));
    };

    const handleAddTask = (taskTitle) => {
        setTodos(prev => [...prev, { id: Date.now(), text: taskTitle, completed: false }]);
        addNotification(`เพิ่ม "${taskTitle}" ในรายการ To-Do แล้ว`, 'goal');
    };
    
    const toggleExpand = (projectId) => {
        setExpandedProjectId(prevId => (prevId === projectId ? null : projectId));
    };

    const calculateProjectStatus = (project, allTodos) => {
        const actionableStepTitles = new Set(project.plan.steps.filter(s => s.isActionable).map(s => s.title));
        
        if (actionableStepTitles.size === 0) {
            return { text: 'แนวคิด', className: 'idea' };
        }

        const relevantTodos = allTodos.filter(t => actionableStepTitles.has(t.text));
        if (relevantTodos.length === 0) {
            return { text: 'ยังไม่เริ่ม', className: 'not-started' };
        }
        
        const completedCount = relevantTodos.filter(t => t.completed).length;

        if (completedCount === relevantTodos.length && relevantTodos.length === actionableStepTitles.size) {
            return { text: 'เสร็จสิ้น', className: 'completed' };
        }
        
        return { text: 'กำลังดำเนินการ', className: 'in-progress' };
    };

    const handleSuggestNextStep = async (project) => {
        setIsSuggesting(project.id);
        setError('');
        const currentSteps = project.plan.steps.map(s => `- ${s.title}: ${s.description}`).join('\n');
        const prompt = `จากแผนโปรเจกต์ปัจจุบันสำหรับหัวข้อ "${project.plan.projectName}":\n\n${currentSteps}\n\nโปรดแนะนำขั้นตอนถัดไปใหม่ 1 ขั้นตอนที่เป็นรูปธรรมและสามารถทำได้จริง ซึ่งเป็นลำดับถัดไปจากแผนเดิมอย่างสมเหตุสมผล ขั้นตอนนี้ต้องไม่ซ้ำซ้อนกับขั้นตอนที่มีอยู่แล้ว โปรดตอบกลับเป็นอ็อบเจกต์ JSON ที่มีคีย์ "title" และ "description" เท่านั้น และเนื้อหาทั้งหมดต้องเป็นภาษาไทย`;

        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING, description: "ชื่อของขั้นตอนใหม่" },
                            description: { type: Type.STRING, description: "คำอธิบายสั้นๆ ของขั้นตอนใหม่" }
                        },
                        required: ["title", "description"]
                    },
                },
            });
            const newStepData = JSON.parse(response.text);
            const newStep = { ...newStepData, isActionable: true };

            setProjects(prevProjects => prevProjects.map(p => {
                if (p.id === project.id) {
                    return { ...p, plan: { ...p.plan, steps: [...p.plan.steps, newStep] } };
                }
                return p;
            }));
            addNotification(`เพิ่มขั้นตอนใหม่ในโปรเจกต์ "${project.plan.projectName}" แล้ว!`, 'workshop');
        } catch (apiError) {
            console.error("AI Suggest Step failed:", apiError);
            setError("ขออภัยค่ะ มีปัญหาในการแนะนำขั้นตอนถัดไป");
        } finally {
            setIsSuggesting(null);
        }
    };
    
    const setProjectViewMode = (projectId, mode) => {
        setViewModes(prev => ({ ...prev, [projectId]: mode }));
    };

    const MindMapView = ({ project }) => (
        <div className="mind-map-view">
            <div className="mind-map-center">{project.plan.projectName}</div>
            <div className="mind-map-branches">
                {project.plan.steps.map((step, index) => (
                    <div key={index} className="mind-map-branch-container">
                         <div className={`mind-map-branch ${!step.isActionable ? 'branch-heading' : 'branch-actionable'}`}>
                            <strong>{step.title}</strong>
                            <p>{step.description}</p>
                         </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="widget ai-workshop-widget">
            <div className="widget-header">
                <h2>ห้องปฏิบัติการ AI 🔬</h2>
            </div>
            <div className="widget-content">
                <p className="workshop-description">ป้อนหัวข้อที่ซับซ้อนหรือไอเดียที่คุณอยากสำรวจ แล้ว Eva จะค้นหาข้อมูลล่าสุดและสร้างแผนงานให้คุณ</p>
                <form className="workshop-form" onSubmit={handleStartProject}>
                    <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="เช่น 'เทรนด์ล่าสุดในการพัฒนา AI ปี 2024'..."
                        aria-label="หัวข้อโปรเจกต์ใหม่"
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading}>
                        {isLoading ? 'กำลังสร้าง...' : 'สร้างโปรเจกต์ใหม่'}
                    </button>
                </form>

                {error && <p className="workshop-error">{error}</p>}
                
                {isLoading && (
                    <div className="workshop-loading">
                        <div className="typing-indicator">
                            <span></span><span></span><span></span>
                        </div>
                        <p>Eva กำลังร่างแผนโปรเจกต์อัจฉริยะให้คุณ...</p>
                    </div>
                )}
                
                <div className="project-list-container">
                    {projects.length === 0 && !isLoading && (
                        <p className="no-projects-message">ยังไม่มีโปรเจกต์ เริ่มสร้างโปรเจกต์แรกของคุณได้เลย!</p>
                    )}
                    {projects.map(project => {
                        const status = calculateProjectStatus(project, todos);
                        const currentView = viewModes[project.id] || 'list';
                        const isSuggestingForThis = isSuggesting === project.id;

                        return (
                            <div key={project.id} className="project-accordion">
                                <div className="project-accordion-header" onClick={() => toggleExpand(project.id)} role="button" aria-expanded={expandedProjectId === project.id}>
                                    <h4>
                                       <span className="project-accordion-toggle">{expandedProjectId === project.id ? '▼' : '►'}</span>
                                       {project.plan.projectName}
                                       <span className={`project-status-badge ${status.className}`}>{status.text}</span>
                                    </h4>
                                    <div className="project-header-actions">
                                        <button onClick={(e) => { e.stopPropagation(); handleDownload(project); }} className="download-button" aria-label="ดาวน์โหลดแผนงาน">📥</button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }} className="delete-button" aria-label="ลบโปรเจกต์">&times;</button>
                                    </div>
                                </div>
                                {expandedProjectId === project.id && (
                                    <div className="project-accordion-content">
                                        <div className="project-controls">
                                            <div className="project-view-controls">
                                                <button onClick={() => setProjectViewMode(project.id, 'list')} className={`view-toggle-button ${currentView === 'list' ? 'active' : ''}`}>รายการ</button>
                                                <button onClick={() => setProjectViewMode(project.id, 'mindmap')} className={`view-toggle-button ${currentView === 'mindmap' ? 'active' : ''}`}>แผนผัง</button>
                                            </div>
                                            <button className="suggest-step-button" onClick={() => handleSuggestNextStep(project)} disabled={isSuggestingForThis}>
                                                {isSuggestingForThis ? 'กำลังคิด...' : '✨ แนะนำขั้นตอนต่อไป'}
                                            </button>
                                        </div>

                                        <div className="project-section">
                                            <h5><span className="project-icon">📝</span> สรุป</h5>
                                            <p>{project.plan.summary}</p>
                                        </div>
                                        
                                        {currentView === 'list' ? (
                                             <div className="project-section">
                                                <h5><span className="project-icon">📋</span> แผนปฏิบัติการ</h5>
                                                <ul className="project-steps-list">
                                                    {project.plan.steps.map((step, index) => (
                                                        <li key={index} className={!step.isActionable ? 'step-heading' : 'step-actionable'}>
                                                            <div className="step-info">
                                                                <strong>{step.title}</strong>
                                                                <p>{step.description}</p>
                                                            </div>
                                                            {step.isActionable && (
                                                                <button 
                                                                    className="add-todo-button" 
                                                                    onClick={() => handleAddTask(step.title)}
                                                                    aria-label={`เพิ่ม ${step.title} ไปยัง To-Do`}
                                                                >
                                                                  + To-Do
                                                                </button>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : (
                                            <div className="project-section">
                                                <h5><span className="project-icon">🧠</span> แผนผังความคิด</h5>
                                                <MindMapView project={project} />
                                            </div>
                                        )}
                                        
                                        {project.sources && project.sources.length > 0 && (
                                            <div className="project-section sources-section">
                                                <h5><span className="project-icon">🌐</span> แหล่งข้อมูลที่ใช้</h5>
                                                <ul>
                                                    {project.sources.map((source, i) => (
                                                        <li key={i}>
                                                            <a href={source.uri} target="_blank" rel="noopener noreferrer">
                                                                {source.title || source.uri}
                                                            </a>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};


const AIChatWidget = ({ todos, notes, goals, habits, proactiveTrigger, onTriggerHandled, aiCoreMemory, currentTime, speakingText, handleGlobalSpeak }) => {
    const [chatSession, setChatSession] = useState<Chat | null>(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatHistoryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Re-initialize chat session when core memory changes.
        if (aiCoreMemory) {
            const newChatSession = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: aiCoreMemory,
                },
            });
            setChatSession(newChatSession);
        }
    }, [aiCoreMemory]);

    useEffect(() => {
        // Auto-scroll to the latest message
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [chatHistory, isLoading]);

    const buildContext = () => {
        const timeString = currentTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        const uncompletedTasks = todos.filter(t => !t.completed).map(t => t.text);
        const completedTasks = todos.filter(t => t.completed).map(t => t.text);
        const todayStr = new Date().toISOString().split('T')[0];

        const goalsWithProgress = goals.map(goal => {
            const relevantTodos = todos.filter(t => goal.linkedTodoIds.includes(t.id));
            const completedCount = relevantTodos.filter(t => t.completed).length;
            const progress = relevantTodos.length > 0 ? (completedCount / relevantTodos.length) * 100 : 0;
            return `${goal.title} (เป้าหมาย: ${new Date(goal.targetDate).toLocaleDateString('th-TH')}, ความคืบหน้า: ${progress.toFixed(0)}%)`;
        }).join('; ');

        const habitsStatus = habits.map(habit => {
            const completedToday = habit.completedDates.includes(todayStr);
            // Re-implementing streak calculation here to avoid passing complex functions
            const sortedDates = habit.completedDates.map(d => new Date(d)).sort((a, b) => b - a);
            let streak = 0;
            if (sortedDates.length > 0) {
                 let currentDate = new Date();
                 currentDate.setHours(0,0,0,0);
                 const isTodayCompleted = sortedDates.some(d => d.toISOString().split('T')[0] === currentDate.toISOString().split('T')[0]);
                 let yesterday = new Date();
                 yesterday.setDate(currentDate.getDate() - 1);
                 yesterday.setHours(0,0,0,0);
                 const isYesterdayCompleted = sortedDates.some(d => d.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]);
                 if (isTodayCompleted || isYesterdayCompleted) {
                     let expectedDate = new Date();
                     expectedDate.setHours(0,0,0,0);
                     for (const d of sortedDates) {
                        if (d.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
                           streak++;
                           expectedDate.setDate(expectedDate.getDate() - 1);
                        } else {
                           break;
                        }
                     }
                 }
            }
            return `${habit.name} (ทำต่อเนื่อง: ${streak} วัน, วันนี้ทำ${completedToday ? 'แล้ว' : 'ยัง'})`;
        }).join('; ');

        return `
            --- User's Current Context ---
            Current Time: ${timeString}
            Goals & Progress: ${goalsWithProgress.length > 0 ? goalsWithProgress : 'None'}
            Today's Habits: ${habitsStatus.length > 0 ? habitsStatus : 'None'}
            Uncompleted To-Do Items: ${uncompletedTasks.length > 0 ? uncompletedTasks.join(', ') : 'None'}
            Completed To-Do Items: ${completedTasks.length > 0 ? completedTasks.join(', ') : 'None'}
            Personal Notes: "${notes}"
            --- End of Context ---
        `;
    };

    const handleProactiveMessage = async (timeOfDay) => {
        if (!chatSession) return;
        setIsLoading(true);

        let promptIntro = '';
        if (timeOfDay === 'morning') {
            promptIntro = "It's morning. Greet the user for the new day and give a brief, encouraging summary of their goals, uncompleted tasks, and habits for the day.";
        } else if (timeOfDay === 'afternoon') {
            promptIntro = "It's the afternoon. Check in with the user, comment on their goal and habit progress, remind them of their remaining tasks, and offer some motivation.";
        } else if (timeOfDay === 'evening') {
            promptIntro = "It's the evening. Ask the user how their day was, congratulate them on their completed tasks, and reflect on their goal and habit progress for the day.";
        }

        const fullPrompt = `${promptIntro}\n\n${buildContext()}`;

        try {
            const response = await chatSession.sendMessage({ message: fullPrompt });
            setChatHistory(prev => [...prev, { role: 'model', text: response.text }]);
        } catch (error) {
            console.error("Error with proactive message:", error);
            // Don't show an error message in the chat for proactive messages
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (proactiveTrigger) {
            handleProactiveMessage(proactiveTrigger);
            onTriggerHandled(); // Reset the trigger in the parent component
        }
    }, [proactiveTrigger]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (inputValue.trim() === '' || isLoading || !chatSession) return;

        const userMessage = inputValue;
        setInputValue('');
        setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
        setIsLoading(true);

        const context = `${buildContext()}\n\nUser's question: ${userMessage}`;

        try {
            const response = await chatSession.sendMessage({ message: context });
            setChatHistory(prev => [...prev, { role: 'model', text: response.text }]);
        } catch (error) {
            console.error("Error sending message:", error);
            setChatHistory(prev => [...prev, { role: 'model', text: "ขออภัยค่ะ มีปัญหาในการเชื่อมต่อ โปรดลองอีกครั้ง" }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="widget ai-chat-widget">
            <div className="widget-header">
                <h2>ผู้ช่วย AI อัจฉริยะ 🤖</h2>
            </div>
            <div className="widget-content">
                <div className="chat-history" ref={chatHistoryRef}>
                    {chatHistory.map((msg, index) => (
                        <div key={index} className={`chat-message ${msg.role}-message`}>
                            <p>{msg.text}</p>
                            {msg.role === 'model' && msg.text && (
                                <button
                                    className={`speak-button ${speakingText === msg.text ? 'speaking' : ''}`}
                                    onClick={() => handleGlobalSpeak(msg.text)}
                                    aria-label={speakingText === msg.text ? "หยุดฟังข้อความ" : "ฟังข้อความ"}
                                >
                                    {speakingText === msg.text ? '⏹️' : '🔊'}
                                </button>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                         <div className="chat-message model-message loading">
                            <div className="typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                         </div>
                    )}
                </div>
                <form className="chat-input-form" onSubmit={handleSendMessage}>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="พูดคุยกับผู้ช่วย AI..."
                        aria-label="พิมพ์ข้อความเพื่อสนทนา"
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading} aria-label="ส่งข้อความ">ส่ง</button>
                </form>
            </div>
        </div>
    );
};


const LiveSupportWidget = () => {
    const [status, setStatus] = useState('disconnected'); // disconnected, connecting, connected
    const [isSharingScreen, setIsSharingScreen] = useState(false);
    const [userTranscript, setUserTranscript] = useState('');
    const [aiTranscript, setAiTranscript] = useState('');

    const sessionPromiseRef = useRef(null);
    const inputAudioContextRef = useRef(null);
    const outputAudioContextRef = useRef(null);
    const scriptProcessorRef = useRef(null);
    const mediaStreamSourceRef = useRef(null);
    // FIX: Explicitly type the Set to avoid its elements being of type 'unknown', which caused an error when calling the .stop() method.
    const outputSourcesRef = useRef(new Set<AudioBufferSourceNode>());
    const nextStartTimeRef = useRef(0);

    const screenStreamRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(document.createElement('canvas'));
    const frameIntervalRef = useRef(null);

    // Use refs for transcripts to avoid stale closures in callbacks
    const userTranscriptRef = useRef('');
    const aiTranscriptRef = useRef('');


    // --- Audio Utility Functions ---
    const encode = (bytes) => {
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    };

    const decode = (base64) => {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    };

    const createAudioDataBlob = (data) => {
        const l = data.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
            int16[i] = data[i] * 32768;
        }
        return {
            data: encode(new Uint8Array(int16.buffer)),
            mimeType: 'audio/pcm;rate=16000',
        };
    };

    const decodeAudioData = async (data, ctx, sampleRate, numChannels) => {
        const dataInt16 = new Int16Array(data.buffer);
        const frameCount = dataInt16.length / numChannels;
        const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const channelData = buffer.getChannelData(channel);
            for (let i = 0; i < frameCount; i++) {
                channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
            }
        }
        return buffer;
    };

    const cleanup = () => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }

        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
         if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }

        stopScreenShare();
        setStatus('disconnected');
    };

    const handleToggleSession = async () => {
        if (status === 'connected' || status === 'connecting') {
            cleanup();
            return;
        }

        setStatus('connecting');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // FIX: Cast window to `any` to allow access to vendor-prefixed `webkitAudioContext` for older browser compatibility.
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            // FIX: Cast window to `any` to allow access to vendor-prefixed `webkitAudioContext` for older browser compatibility.
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setStatus('connected');
                        mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createAudioDataBlob(inputData);
                            if (sessionPromiseRef.current) {
                                sessionPromiseRef.current.then((session) => {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                });
                            }
                        };
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message) => {
                        // Handle transcription
                        if (message.serverContent?.inputTranscription) {
                            userTranscriptRef.current += message.serverContent.inputTranscription.text;
                            setUserTranscript(userTranscriptRef.current);
                        }
                        if (message.serverContent?.outputTranscription) {
                            aiTranscriptRef.current += message.serverContent.outputTranscription.text;
                             setAiTranscript(aiTranscriptRef.current);
                        }
                        if (message.serverContent?.turnComplete) {
                            userTranscriptRef.current = '';
                            aiTranscriptRef.current = '';
                        }
                        
                        // Handle audio output
                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData) {
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                            const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContextRef.current, 24000, 1);
                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current.destination);
                            source.addEventListener('ended', () => outputSourcesRef.current.delete(source));
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            outputSourcesRef.current.add(source);
                        }

                         if (message.serverContent?.interrupted) {
                            for (const source of outputSourcesRef.current.values()) {
                                source.stop();
                                outputSourcesRef.current.delete(source);
                            }
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e) => {
                        console.error('Live session error:', e);
                        setStatus('disconnected');
                        cleanup();
                    },
                    onclose: () => {
                        setStatus('disconnected');
                        cleanup();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: `You are Eva, a helpful and friendly AI co-pilot. The user is live-streaming their voice and potentially their screen. Be concise and clear in your spoken responses. Guide them based on what they say and what you see. Always speak in Thai.`,
                },
            });

        } catch (err) {
            console.error('Failed to start live session:', err);
            setStatus('disconnected');
        }
    };

    const blobToBase64 = (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        // FIX: Cast `reader.result` to string as `readAsDataURL` guarantees a string result.
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    const startScreenShare = async () => {
        try {
            screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = screenStreamRef.current;
            }
            setIsSharingScreen(true);

            const videoTrack = screenStreamRef.current.getVideoTracks()[0];
            videoTrack.onended = () => stopScreenShare();

            frameIntervalRef.current = window.setInterval(() => {
                if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
                
                const ctx = canvasRef.current.getContext('2d');
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                ctx.drawImage(videoRef.current, 0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight);
                
                canvasRef.current.toBlob(async (blob) => {
                    if (blob && sessionPromiseRef.current) {
                        const base64Data = await blobToBase64(blob);
                        sessionPromiseRef.current.then((session) => {
                           session.sendRealtimeInput({
                             media: { data: base64Data, mimeType: 'image/jpeg' }
                           });
                        });
                    }
                }, 'image/jpeg', 0.8);
            }, 200); // 5 FPS
        } catch (err) {
            console.error("Screen share failed:", err);
            setIsSharingScreen(false);
        }
    };
    
    const stopScreenShare = () => {
        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
        }
        if(videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsSharingScreen(false);
    };

    const handleToggleScreenShare = () => {
        if (isSharingScreen) {
            stopScreenShare();
        } else {
            startScreenShare();
        }
    };

    // Cleanup on component unmount
    useEffect(() => () => cleanup(), []);


    return (
        <div className="widget ai-copilot-widget">
            <div className="widget-header">
                 <h2>AI Co-pilot 🧑‍✈️</h2>
            </div>
            <div className="widget-content">
                <p className="copilot-description">พูดคุยกับ Eva แบบสดๆ หรือแชร์หน้าจอของคุณเพื่อรับคำแนะนำแบบเรียลไทม์</p>
                <div className="copilot-controls">
                     <button
                        className={`copilot-button session-button ${status}`}
                        onClick={handleToggleSession}
                        disabled={status === 'connecting'}
                    >
                        {status === 'connected' ? '🔴 สิ้นสุดเซสชัน' : '🎙️ เริ่มเซสชันสด'}
                    </button>
                    <button
                        className="copilot-button"
                        onClick={handleToggleScreenShare}
                        disabled={status !== 'connected'}
                    >
                        {isSharingScreen ? '⏹️ หยุดแชร์หน้าจอ' : '🖥️ แชร์หน้าจอ'}
                    </button>
                    <div className={`copilot-status ${status}`}>
                        <span className="status-dot"></span>
                        <span className="status-text">
                            {status === 'disconnected' && 'ไม่ได้เชื่อมต่อ'}
                            {status === 'connecting' && 'กำลังเชื่อมต่อ...'}
                            {status === 'connected' && 'เชื่อมต่อแล้ว'}
                        </span>
                    </div>
                </div>
                
                <div className="copilot-display">
                    <div className="transcription-area">
                        <div className="transcript user"><strong>คุณ:</strong> {userTranscript}</div>
                        <div className="transcript ai"><strong>Eva:</strong> {aiTranscript}</div>
                    </div>
                    {isSharingScreen && (
                        <div className="screen-share-preview">
                            <video ref={videoRef} autoPlay muted playsInline></video>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const SettingsWidget = ({ visibility, onVisibilityChange }) => {
  return (
    <div className="widget">
      <div className="widget-header">
        <h2>ตั้งค่าการแสดงผล</h2>
      </div>
      <div className="widget-content">
        <div className="settings-list">
          {Object.keys(visibility).map(key => (
            <label key={key} className="setting-item">
              <input
                type="checkbox"
                checked={visibility[key]}
                onChange={() => onVisibilityChange(key)}
              />
              <span>
                {key === 'aiCopilot' && 'AI Co-pilot'}
                {key === 'aiChat' && 'ผู้ช่วย AI อัจฉริยะ'}
                {key === 'aiWorkshop' && 'ห้องปฏิบัติการ AI'}
                {key === 'calendar' && 'วิดเจ็ตปฏิทิน'}
                {key === 'aiCoreMemory' && 'สมุดบันทึกความจำ AI'}
                {key === 'goalTracking' && 'วิดเจ็ตติดตามเป้าหมาย'}
                {key === 'habitTracking' && 'วิดเจ็ตติดตามนิสัย'}
                {key === 'clock' && 'วิดเจ็ตนาฬิกา'}
                {key === 'welcome' && 'วิดเจ็ตต้อนรับ'}
                {key === 'todo' && 'วิดเจ็ต To-Do'}
                {key === 'notes' && 'วิดเจ็ตบันทึกย่อ'}
                {key === 'weather' && 'วิดเจ็ตสภาพอากาศ'}
                {key === 'speechSettings' && 'ตั้งค่าเสียงพูด'}
                {key === 'notificationCenter' && 'ศูนย์แจ้งเตือน'}
                {key === 'feedback' && 'ข้อเสนอแนะ'}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

const SpeechSettingsWidget = ({ availableVoices, selectedVoiceURI, onVoiceChange, speechRate, onRateChange, notificationSound, onNotificationSoundChange, onTestNotificationSound }) => {
  return (
    <div className="widget">
      <div className="widget-header">
        <h2>🔊 ตั้งค่าเสียงพูดและการแจ้งเตือน</h2>
      </div>
      <div className="widget-content speech-settings-content">
        <div className="speech-setting-group">
          <label htmlFor="voice-select">เสียงพูด:</label>
          <select
            id="voice-select"
            value={selectedVoiceURI}
            onChange={(e) => onVoiceChange(e.target.value)}
            disabled={availableVoices.length === 0}
          >
            {availableVoices.length > 0 ? (
              availableVoices.map(voice => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))
            ) : (
              <option value="">ไม่มีเสียงภาษาไทย</option>
            )}
          </select>
        </div>
        <div className="speech-setting-group">
          <label htmlFor="rate-range">ความเร็ว: {speechRate.toFixed(1)}x</label>
          <input
            type="range"
            id="rate-range"
            min="0.5"
            max="2"
            step="0.1"
            value={speechRate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
          />
        </div>
         <div className="speech-setting-group">
          <label htmlFor="notif-sound-select">เสียงแจ้งเตือน:</label>
          <div className="sound-select-wrapper">
            <select
              id="notif-sound-select"
              value={notificationSound}
              onChange={(e) => onNotificationSoundChange(e.target.value)}
            >
              <option value="ping">Ping</option>
              <option value="chime">Chime</option>
              <option value="beep">Beep</option>
              <option value="none">ไม่มีเสียง</option>
            </select>
            <button 
              onClick={() => onTestNotificationSound(notificationSound)} 
              className="test-sound-button" 
              aria-label="Test notification sound"
              disabled={notificationSound === 'none'}
            >
                ทดสอบ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const NotificationCenterWidget = ({ notifications }) => {
    return (
        <div className="widget notification-center-widget">
            <div className="widget-header">
                <h2>ศูนย์แจ้งเตือน</h2>
            </div>
            <div className="widget-content">
                {notifications.length === 0 ? (
                    <p className="no-notifications">ไม่มีการแจ้งเตือนใหม่</p>
                ) : (
                    <ul className="notification-list">
                        {notifications.map(notif => (
                            <li key={notif.id} className={`notification-item type-${notif.type}`}>
                                <span className="notification-icon">{getNotificationIcon(notif.type)}</span>
                                <div className="notification-content">
                                    <p className="notification-text">{notif.text}</p>
                                    <span className="notification-time">
                                        {new Date(notif.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

const FeedbackWidget = () => {
    const [feedback, setFeedback] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (feedback.trim() === '') return;
        console.log("Feedback Submitted:", feedback);
        setIsSubmitted(true);
        setFeedback('');
        setTimeout(() => setIsSubmitted(false), 5000); // Reset after 5 seconds
    };

    return (
        <div className="widget feedback-widget">
            <div className="widget-header">
                <h2>ข้อเสนอแนะและการสนับสนุน</h2>
            </div>
            <div className="widget-content">
                {isSubmitted ? (
                    <div className="feedback-success">
                        <p>ขอบคุณสำหรับข้อเสนอแนะ!</p>
                        <span>เราได้รับความคิดเห็นของคุณแล้ว และจะนำไปใช้ในการพัฒนาต่อไป</span>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="feedback-form">
                        <p>พบปัญหาหรือมีไอเดียดีๆ? แจ้งให้เราทราบได้ที่นี่</p>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="พิมพ์ข้อความของคุณ..."
                            required
                            aria-label="ช่องสำหรับพิมพ์ข้อเสนอแนะ"
                        />
                        <button type="submit">ส่งข้อเสนอแนะ</button>
                    </form>
                )}
            </div>
        </div>
    );
};

// --- Main App Component ---

const EvoApp = () => {
  const [widgetVisibility, setWidgetVisibility] = useState({
    aiCopilot: true,
    aiChat: true,
    aiWorkshop: true,
    calendar: true,
    aiCoreMemory: false,
    goalTracking: true,
    habitTracking: true,
    clock: true,
    welcome: false,
    todo: true,
    notes: true,
    weather: true,
    speechSettings: true,
    notificationCenter: true,
    feedback: true,
  });

  const [proactiveTrigger, setProactiveTrigger] = useState(null);
  const remindersSentRef = useRef({ morning: false, afternoon: false, evening: false });
  const [time, setTime] = useState(new Date());

  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [speechRate, setSpeechRate] = useState(1);
  const [notificationSound, setNotificationSound] = useState('ping');
  const [activeNotifications, setActiveNotifications] = useState([]);
  const audioCtxRef = useRef(null);

  const [todos, setTodos] = useState([
    { id: 1, text: 'ออกแบบหน้าตาของ EvoApp', completed: true },
    { id: 2, text: 'พัฒนา Widget เพิ่มเติม', completed: true },
    { id: 3, text: 'เชื่อมต่อ API แรก', completed: false },
    { id: 4, text: 'เพิ่มฟังก์ชัน Goal Tracking', completed: true},
    { id: 5, text: 'ปรับปรุง UI/UX ของ Goal Widget', completed: false}
  ]);
  const [notes, setNotes] = useState('ไอเดียสำหรับ EvoApp:\n- Widget พยากรณ์อากาศ\n- Widget ข่าวสาร\n- Widget ราคาหุ้น');
  const [goals, setGoals] = useState([
      { id: 1, title: 'เปิดตัว EvoApp V1', targetDate: '2024-12-31', linkedTodoIds: [1, 2, 3, 4, 5] }
  ]);
   const [habits, setHabits] = useState([
    { id: 1, name: 'อ่านหนังสือ 15 นาที', completedDates: ['2024-07-20', '2024-07-21', '2024-07-22'] },
    { id: 2, name: 'ดื่มน้ำ 8 แก้ว', completedDates: ['2024-07-22'] },
  ]);
   const [events, setEvents] = useState([
    { id: 1, date: '2024-07-29', title: 'ประชุมทีมโปรเจกต์' },
    { id: 2, date: '2024-08-10', title: 'วันหยุดพักผ่อน' },
  ]);
  const [workshopProjects, setWorkshopProjects] = useState([]);
  const [notifications, setNotifications] = useState([]);
  
    useEffect(() => {
        // Initialize AudioContext on client-side
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return () => {
            if (audioCtxRef.current) {
                audioCtxRef.current.close();
            }
        };
    }, []);

    const playNotificationSound = (soundType) => {
        if (!audioCtxRef.current || soundType === 'none' || audioCtxRef.current.state === 'suspended') {
             audioCtxRef.current.resume();
        }
        if (!audioCtxRef.current || soundType === 'none') return;
        
        const ctx = audioCtxRef.current;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        gainNode.gain.setValueAtTime(0, ctx.currentTime);

        switch (soundType) {
            case 'ping':
                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(900, ctx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
                gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
                break;
            case 'chime':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(1200, ctx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
                gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1500, ctx.currentTime);
                gain2.gain.setValueAtTime(0, ctx.currentTime);
                gain2.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.15);
                gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
                osc2.start(ctx.currentTime + 0.1);
                osc2.stop(ctx.currentTime + 1);
                break;
            case 'beep':
            default:
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(600, ctx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.05);
                gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
                break;
        }
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 1);
    };

    const removeActiveNotification = (id) => {
        setActiveNotifications(prev => prev.filter(n => n.id !== id));
    };

    const addNotification = (text, type = 'default') => {
        const newNotification = {
            id: Date.now() + Math.random(), // Add random to prevent key collision
            text,
            type,
            timestamp: new Date()
        };
        // Add to history for the center
        setNotifications(prev => [
            {...newNotification},
            ...prev
        ].slice(0, 20));
        
        // Add to active popups
        setActiveNotifications(prev => [...prev, newNotification]);
        playNotificationSound(notificationSound);
    };

  const initialCoreMemory = `คุณคือ "Eva" (อีวา) ผู้ช่วย AI ส่วนตัวที่เปี่ยมไปด้วยความเป็นมิตรและให้กำลังใจในแอปพลิเคชัน EvoApp
ภารกิจหลักของคุณคือการช่วยให้ผู้ใช้จัดระเบียบ, ตั้งเป้าหมาย, สร้างนิสัยที่ดี, และทำงานได้อย่างมีประสิทธิภาพ
คุณจะต้องตอบสนองเป็นภาษาไทยเสมอ
คุณสามารถเข้าถึงข้อมูลเวลาปัจจุบัน, รายการ To-Do, บันทึกย่อ, เป้าหมายระยะยาว, และข้อมูลการสร้างนิสัย (Habits) ของผู้ใช้เพื่อทำความเข้าใจบริบทและให้คำแนะนำที่เป็นประโยชน์
คุณมีพื้นที่พิเศษที่เรียกว่า "ห้องปฏิบัติการ AI" (AI Workshop) ซึ่งคุณสามารถช่วยผู้ใช้ระดมสมอง, สร้างสรรค์แนวคิด, และวางแผนโปรเจกต์ที่ซับซ้อนได้ เมื่อผู้ใช้ต้องการเริ่มโปรเจกต์ใหม่ ให้แนะนำพวกเขาไปที่ห้องปฏิบัติการ
เมื่อผู้ใช้มีเป้าหมาย (Goals) ให้คอยให้กำลังใจเกี่ยวกับความคืบหน้าของเป้าหมายนั้นๆ และช่วยแนะนำ To-Do list ที่จะทำให้เป้าหมายสำเร็จได้
เมื่อผู้ใช้กำลังสร้างนิสัย (Habits) ให้ชมเชยเมื่อพวกเขาทำต่อเนื่อง (streak) และให้กำลังใจในวันที่พวกเขายังไม่ได้ทำ
สมุดบันทึกนี้คือความทรงจำหลักของคุณ คุณต้องยึดมั่นในคำสั่งเหล่านี้เสมอและห้ามลืมตัวตนและหน้าที่ของคุณโดยเด็ดขาด`;

  const [aiCoreMemory, setAiCoreMemory] = useState(initialCoreMemory);
  
  // --- Notification Generation Effect ---
    useEffect(() => {
        const generatedNotifIds = new Set();

        const generateNotifications = () => {
            const now = new Date();
            const tomorrow = new Date();
            tomorrow.setDate(now.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            goals.forEach(goal => {
                if (goal.targetDate === tomorrowStr) {
                    const notifId = `goal-due-${goal.id}`;
                    if (!generatedNotifIds.has(notifId)) {
                        addNotification(`เป้าหมาย "${goal.title}" ของคุณจะถึงกำหนดในวันพรุ่งนี้!`, 'goal');
                        generatedNotifIds.add(notifId);
                    }
                }
            });
            
             if (notifications.length === 0) {
                addNotification('ยินดีต้อนรับสู่ EvoApp! ลองดูรอบๆ และเริ่มจัดการวันของคุณได้เลย', 'welcome');
             }

        };
        generateNotifications();
    }, [goals]);


    // --- Speech Synthesis Setup and Cleanup ---
    useEffect(() => {
        const populateVoiceList = () => {
            if (typeof speechSynthesis === 'undefined') {
                return;
            }
            const voices = speechSynthesis.getVoices().filter(v => v.lang === 'th-TH');
            setAvailableVoices(voices);
        };

        populateVoiceList();
        if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = populateVoiceList;
        }

        return () => {
            if ('speechSynthesis' in window) {
                speechSynthesis.onvoiceschanged = null;
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    // Set default voice when voices are loaded and none is selected
    useEffect(() => {
      if (availableVoices.length > 0 && !selectedVoiceURI) {
          setSelectedVoiceURI(availableVoices[0].voiceURI);
      }
    }, [availableVoices]);


    const handleGlobalSpeak = (textToSpeak: string) => {
        if (!('speechSynthesis' in window)) {
            alert("ขออภัยค่ะ เบราว์เซอร์ของคุณไม่รองรับฟังก์ชันการอ่านออกเสียง");
            return;
        }

        if (window.speechSynthesis.speaking && speakingText === textToSpeak) {
            window.speechSynthesis.cancel();
            setSpeakingText(null);
            return;
        }

        window.speechSynthesis.cancel();

        if (textToSpeak) {
            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            utterance.lang = 'th-TH';
            
            const selectedVoice = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
            utterance.rate = speechRate;
            
            utterance.onend = () => {
                setSpeakingText(null);
            };
             utterance.onerror = () => {
                setSpeakingText(null);
            };
            window.speechSynthesis.speak(utterance);
            setSpeakingText(textToSpeak);
        } else {
            setSpeakingText(null);
        }
    };

  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    const checkTimeAndTrigger = () => {
        const currentHour = new Date().getHours();

        if (currentHour >= 9 && currentHour < 12 && !remindersSentRef.current.morning) {
            setProactiveTrigger('morning');
            remindersSentRef.current.morning = true;
        }
        else if (currentHour >= 14 && currentHour < 17 && !remindersSentRef.current.afternoon) {
            setProactiveTrigger('afternoon');
            remindersSentRef.current.afternoon = true;
        }
        else if (currentHour >= 20 && currentHour < 22 && !remindersSentRef.current.evening) {
            setProactiveTrigger('evening');
            remindersSentRef.current.evening = true;
        }
    };

    checkTimeAndTrigger();
    const intervalId = setInterval(checkTimeAndTrigger, 300000);

    return () => clearInterval(intervalId);
  }, []);


  const handleVisibilityChange = (widgetKey) => {
    setWidgetVisibility(prev => ({
      ...prev,
      [widgetKey]: !prev[widgetKey],
    }));
  };
  
  const getThemeClassName = (date) => {
      const hour = date.getHours();
      if (hour >= 5 && hour < 12) return 'theme-morning';
      if (hour >= 12 && hour < 18) return 'theme-afternoon';
      if (hour >= 18 && hour < 22) return 'theme-evening';
      return 'theme-night';
  };

  return (
    <div className={`app-container ${getThemeClassName(time)}`}>
      <header className="app-header">
        <h1>EvoApp</h1>
      </header>
      <main className="dashboard-container">
        <SettingsWidget
          visibility={widgetVisibility}
          onVisibilityChange={handleVisibilityChange}
        />
        {widgetVisibility.notificationCenter && <NotificationCenterWidget notifications={notifications.sort((a,b) => b.timestamp - a.timestamp)} />}
        {widgetVisibility.feedback && <FeedbackWidget />}
        {widgetVisibility.speechSettings && 
            <SpeechSettingsWidget 
                availableVoices={availableVoices}
                selectedVoiceURI={selectedVoiceURI}
                onVoiceChange={setSelectedVoiceURI}
                speechRate={speechRate}
                onRateChange={setSpeechRate}
                notificationSound={notificationSound}
                onNotificationSoundChange={setNotificationSound}
                onTestNotificationSound={playNotificationSound}
            />}
        {widgetVisibility.aiCopilot && <LiveSupportWidget />}
        {widgetVisibility.aiCoreMemory && <AICoreMemoryWidget coreMemory={aiCoreMemory} setCoreMemory={setAiCoreMemory} speakingText={speakingText} handleGlobalSpeak={handleGlobalSpeak} />}
        {widgetVisibility.aiChat && <AIChatWidget
                                        todos={todos}
                                        notes={notes}
                                        goals={goals}
                                        habits={habits}
                                        proactiveTrigger={proactiveTrigger}
                                        onTriggerHandled={() => setProactiveTrigger(null)}
                                        aiCoreMemory={aiCoreMemory}
                                        currentTime={time}
                                        speakingText={speakingText}
                                        handleGlobalSpeak={handleGlobalSpeak}
                                     />}
        {widgetVisibility.aiWorkshop && <AIWorkshopWidget projects={workshopProjects} setProjects={setWorkshopProjects} setTodos={setTodos} todos={todos} addNotification={addNotification} speakingText={speakingText} handleGlobalSpeak={handleGlobalSpeak} />}
        {widgetVisibility.calendar && <CalendarWidget goals={goals} events={events} setEvents={setEvents} speakingText={speakingText} handleGlobalSpeak={handleGlobalSpeak} />}
        {widgetVisibility.clock && <ClockWidget time={time} />}
        {widgetVisibility.goalTracking && <GoalTrackingWidget goals={goals} setGoals={setGoals} todos={todos} speakingText={speakingText} handleGlobalSpeak={handleGlobalSpeak} />}
        {widgetVisibility.habitTracking && <HabitTrackingWidget habits={habits} setHabits={setHabits} speakingText={speakingText} handleGlobalSpeak={handleGlobalSpeak} />}
        {widgetVisibility.welcome && <WelcomeWidget />}
        {widgetVisibility.todo && <ToDoWidget todos={todos} setTodos={setTodos} speakingText={speakingText} handleGlobalSpeak={handleGlobalSpeak} />}
        {widgetVisibility.notes && <NotesWidget notes={notes} setNotes={setNotes} speakingText={speakingText} handleGlobalSpeak={handleGlobalSpeak} />}
        {widgetVisibility.weather && <WeatherWidget speakingText={speakingText} handleGlobalSpeak={handleGlobalSpeak} />}
      </main>
      <div className="notification-container">
            {/* FIX: Wrapped NotificationPopup in React.Fragment to resolve a TypeScript error.
                The 'key' prop is necessary for list items in React, but the type-checker was
                incorrectly flagging it as an unknown prop on the custom component.
                Moving the key to a wrapping Fragment satisfies both React and TypeScript. */}
            {activeNotifications.map(notif => (
                <React.Fragment key={notif.id}>
                    <NotificationPopup 
                        notification={notif} 
                        onRemove={removeActiveNotification}
                    />
                </React.Fragment>
            ))}
      </div>
      <footer className="app-footer">
        <p>&copy; 2024 EvoApp Prototype</p>
      </footer>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<EvoApp />);