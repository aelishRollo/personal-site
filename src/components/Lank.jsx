import { Routes, Route, BrowserRouter, Link } from 'react-router-dom';
export default function Lank() {
    return (
      <ul>
        <li>
          <Link to="/"> Home </Link>
        </li>
        <li>
          <Link to="/Todo"> Todo App </Link>
        </li>
        <li>
          <Link to="/Coco"> Coco </Link>
        </li>
        <li>
          <Link to="/Joy"> Joy </Link>
        </li>
      </ul>
    );
  }
