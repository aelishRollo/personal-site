import { Routes, Route, BrowserRouter, Link } from 'react-router-dom';

export default function Projects() {
    return (
      <header className='App-header'>
        <h1 className='App-subheader'>  
          Some Things I made
        </h1>
        <h3 className='App-subheader'>
          Me in 10 seconds
        </h3>

        <Link to="/Todo-test"> Here's a todo list app I built from scratch, like a nice apple pie</Link>
        
        <p className='App-paragraph'>
        I love meeting new people, and I reply to every email, so <Link to="/Contact"> say hello </Link>.
        </p>
        
      </header>
    );
  }
