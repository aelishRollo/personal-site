import '../App.css';
import { Routes, Route, BrowserRouter, Link } from 'react-router-dom';
import ContactForm from './ContactForm';

export default function Contact() {

    return (
        <div className="App">
            <header className="App-header">
                <div className='dark-mode'>
                <ContactForm />
                </div>
                
            </header >
        </div>
               
        );
}
