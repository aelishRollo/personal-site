
    //I like the convention of having comments at the top. And of removing comments as much as possible.
    //Keep it tidy.

    //I want the code in this file to largely be the same. So I want it to get isVisisible
    //and its setter as props from Todo.tsx

    //To do that I'll build a second button which is basically the same, just with an arbitrary name, get that functioning properly,
    //then copy and paste its code back to the first button. Like building a clone of it to make sure I can copy it. 

    type RenderSpecificTodoProps = {
        isVisible:boolean,
        setIsVisible: (value:boolean) => void;      //I love this function signature
        handleButtonClick: () => void
    }

   
     const Gonzo: React.FC<RenderSpecificTodoProps> = ({ isVisible, setIsVisible, handleButtonClick }) => {
        let result = <> </>


    
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
    
      export default Gonzo
