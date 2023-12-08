import '../App.css';
import { Routes, Route, BrowserRouter, Link } from 'react-router-dom';

export default function Contact() {

    return (
        <div className="App">
            <header className="App-header">
                <p>
                I love meeting new people, and I reply to every email, so <Link to="/Contact"> say hello </Link>.
                </p>
            </header >
        </div>
               
        );
}
