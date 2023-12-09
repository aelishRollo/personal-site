import React from "react";


const HomeButton:React.FC = () => {
    const navigateHome = () => {
      window.location.href = '/';
    };
  
    return (
      <button onClick={navigateHome} className="home-button">
        Home
      </button>
    );
  };

export default HomeButton
