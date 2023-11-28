
    //I like the convention of having comments at the top. And of removing comments as much as possible.
    //Keep it tidy.

    //I want the code in this file to largely be the same. So I want it to get isVisisible
    //and its setter as props from Todo.tsx

    //To do that I'll build a second button which is basically the same, just with an arbitrary name, get that functioning properly,
    //then copy and paste its code back to the first button. Like building a clone of it to make sure I can copy it. 


import { useState } from "react"
export default function RenderSpecifcTodo() {
    let result = <> </>
    let [isVisible,setIsVisible] = useState(false)

    const handleButtonClick = () => {   
        setIsVisible(!isVisible)    //change isVisible's value
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
