import { useState } from "react"
export default function RenderSpecifcTodo() {
    let result = <> </>
    let [isVisible,setIsVisible] = useState(false)

    const handleButtonClick = () => {
        setIsVisible(!isVisible)
    }

    if (isVisible) {
        result = <div> Hi I'm a div</div>
    };
    if (!isVisible) {
        result = <> </>
    }


    return (
      <>
      <button onClick={handleButtonClick}> Hi I'm the button, friend</button> 
      {result}
      </>
    );  
  }
