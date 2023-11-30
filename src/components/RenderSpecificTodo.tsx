
type RenderSpecificTodoProps = {
    isVisible:boolean,
    setIsVisible: (value:boolean) => void;      //I love this function signature
    handleButtonClick: () => void
}


 const RenderSpecificTodo: React.FC<RenderSpecificTodoProps> = ({ isVisible, setIsVisible, handleButtonClick }) => {
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

  export default RenderSpecificTodo
