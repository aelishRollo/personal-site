import React, { useState } from "react";


type TodoType = {
    id: number;
    name: string;
    urgent?: boolean;
    important?: boolean;
    parent_id?: number;
};


type RenderSpecificTodoProps = {
    handleButtonClick: () => void;
    isVisible: boolean;
    currentTodo: TodoType;
    getTodoParentsStringList: (todoId:number) => string[];
}



const RenderSpecificTodo: React.FC<RenderSpecificTodoProps> = ({ handleButtonClick, isVisible, currentTodo, getTodoParentsStringList }) => {
    let [viewFamilyTreeButtonClick, setViewFamilyTreeButtonClick] = useState(false)

    const handleViewFamilyTreeButtonClick = () => {     //toggles if family tree is visible
        setViewFamilyTreeButtonClick(!viewFamilyTreeButtonClick)
    }


    const ViewFamilyTree = () => {
        let result = <> </>

        if (viewFamilyTreeButtonClick) {
            result = (
                <div>
                  <ul>
                    {getTodoParentsStringList(currentTodo.id).map((todoName, index) => (
                      <li key={index}>{todoName}</li>
                    ))}
                  </ul>
                </div>
              );
              
        }
        else result = <> </>

        return (
            result
        )
    }

    let result = <> </>
    let todoIsVisible = isVisible
    if (todoIsVisible) {
        result = <div>
            <button onClick={handleButtonClick}> Back</button>
            <button onClick={handleViewFamilyTreeButtonClick}> View Family Tree</button>  {/* need to complete */}
            <button onClick={handleButtonClick}> Edit</button>  {/* need to complete */}
            <button onClick={handleButtonClick}> Delete</button>  {/* need to complete */}
            <h3>Selected Todo Item:</h3>
            <table className='TodoTable' >
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Urgent</th>
                        <th>Important</th>
                        <th>Parent ID</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>{currentTodo.name}</td>
                        <td>{JSON.stringify(currentTodo.urgent)}</td>
                        <td>{JSON.stringify(currentTodo.important)}</td>
                        <td>{JSON.stringify(currentTodo.parent_id)}</td>
                    </tr>

                </tbody>
            </table>
        <ViewFamilyTree />
        </div>
    }
    else {
        result = <> </>
    }

    return (
        result
    )
};

export default RenderSpecificTodo
