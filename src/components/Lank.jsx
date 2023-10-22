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
          <Link to="/Contact"> Contact </Link>
        </li>
        <li>
          <Link to="/Joy"> Joy </Link>
        </li>
      </ul>
    );
  }
//this component renders an actual clickable link on the page with its url, and provides the text for the link
//this specific component does it four times
