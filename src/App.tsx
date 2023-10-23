import React from 'react';
import logo from './logo.svg';
import './App.css';
import { Routes, Route, BrowserRouter, Link } from 'react-router-dom';
import Todo from './components/Todo';
import Navbar from './components/Navbar';
import Lank from './components/Lank';
import Joy from './components/Joy'
import HomePage from './components/Homepage';
import Contact from './components/Contact';



function App() {
  return (
    <div className="App">
      
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/Todo" element={<Todo />} />
          <Route path="/Contact" element={<Contact />} />
          <Route path="/Joy" element={<Joy />} />
          
        </Routes>
      </BrowserRouter>
    </div>
  );
}
//the code block above associates the current path the component to be rendered when that page is visited

export default App;
