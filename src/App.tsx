import './App.css';
import { Routes, Route, BrowserRouter } from 'react-router-dom';
import Todo from './components/Todo';
import HomePage from './components/Homepage';
import Contact from './components/Contact';
import Music from './components/AboutMusic';
import Webdev from './components/AboutDev';
import Projects from './components/Projects';
import TodoTest from './components/TodoTest'


function App() {
  return (
    <div className="App">
      
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/Todo" element={<Todo />} />
          <Route path="/Contact" element={<Contact />} />
          <Route path="/AboutMusic" element={<Music />} />
          <Route path="/AboutDev" element={<Webdev />} />
          <Route path="/Projects" element={<Projects />} />
          <Route path="/Todo-test" element={<TodoTest />} />
          
        </Routes>
      </BrowserRouter>
    </div>
  );
}
//the code block above associates the current path the component to be rendered when that page is visited

export default App;
