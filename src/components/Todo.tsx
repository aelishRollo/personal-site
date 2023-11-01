import React, { useState, useEffect, FormEvent, ReactElement } from 'react';
import '../App.css';
import TodoTable from './TodoTable';

type TodoType = {
    id: number;
    name: string;
    urgent: boolean;
    important: boolean;
};

type TodoFormProps = {
    addTodo: (todo: TodoType) => void;
}



type TodoListProps = {
    todos: TodoType[];
    deleteMode: boolean;
    toDelete: number[];
    toggleDelete: (id: number) => void;
};


export default function App() {
    const [deleteMode, setDeleteMode] = useState(false);
    const [todos, setTodos] = useState<TodoType[]>([]);
    const [displayTodos, setDisplayTodos] = useState<TodoType[]>([]);
    const [toDelete, setToDelete] = useState<number[]>([]);

    const [showForm, setShowForm] = useState(false);

    const handleDeleteConfirmation = () => {
        const updatedTodos = todos.filter(todo => !toDelete.includes(todo.id));
        setTodos(updatedTodos);
        setDisplayTodos(updatedTodos);
        setDeleteMode(false);
        setToDelete([]);
        localStorage.setItem('todos', JSON.stringify(updatedTodos));
    }

    const toggleDelete = (id: number) => {
        if (toDelete.includes(id)) {
            setToDelete(prevToDelete => prevToDelete.filter(todoId => todoId !== id));
        } else {
            setToDelete(prevToDelete => [...prevToDelete, id]);
        }
    };


    type FilterType = 'all' | 'urgent' | 'important' | 'delete';

    const filterTodos = (type: FilterType) => {
        switch (type) {
            case 'urgent':
                setDisplayTodos(todos.filter(todo => todo.urgent));
                break;
            case 'important':
                setDisplayTodos(todos.filter(todo => todo.important));
                break;
            case 'delete':
                setDisplayTodos(todos.filter(todo => toDelete.includes(todo.id)));
                break;
            default:
                setDisplayTodos(todos);
                break;
        }
    };

    

    


    function TodoForm({ addTodo }: TodoFormProps): JSX.Element {
        const [name, setName] = useState('');
        const [urgent, setUrgent] = useState(false);
        const [important, setImportant] = useState(false);

        const handleSubmit = (e: FormEvent) => {
            e.preventDefault();
            addTodo({ id: Date.now(), name, urgent, important });
            setName('');
            setUrgent(false);
            setImportant(false);
        }


        return (
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Todo Name"
                />
                <label>
                    Urgent:
                    <input
                        type="checkbox"
                        checked={urgent}
                        onChange={e => setUrgent(e.target.checked)}
                    />
                </label>
                <label>
                    Important:
                    <input
                        type="checkbox"
                        checked={important}
                        onChange={e => setImportant(e.target.checked)}
                    />
                </label>
                <button type="submit">Add</button>
            </form>
        );


    }


    useEffect(() => {
        async function fetchData() {
            const localStorageData = localStorage.getItem('todos');
            if (localStorageData) {
                const localTodos = JSON.parse(localStorageData);
                setTodos(localTodos);
                setDisplayTodos(localTodos);
            } else {
                const response = await fetch(process.env.PUBLIC_URL + '/todo.json');
                const data = await response.json();
                setTodos(data);
                setDisplayTodos(data);
            }
        }
        fetchData();
    }, []);

    const addTodo = (newTodo: TodoType) => {
        const updatedTodos = [...todos, newTodo];
        setTodos(updatedTodos);
        setDisplayTodos(updatedTodos);
        setShowForm(false);
        localStorage.setItem('todos', JSON.stringify(updatedTodos));
    };

    function TodoList({ todos, deleteMode, toDelete, toggleDelete }: TodoListProps) {
        return (
            <ul>
                {todos.map(todo => (
                    <li key={todo.id}>
                        {deleteMode && (
                            <input
                                type="checkbox"
                                checked={toDelete.includes(todo.id)} // This line ensures the checkbox reflects the toDelete state
                                onChange={() => toggleDelete(todo.id)}
                            />
                        )}
                        {todo.name}
                        {todo.urgent && <span> (Urgent)</span>}
                        {todo.important && <span> (Important)</span>}
                    </li>
                ))}
            </ul>
        );
    }
    

    return (
        <div className="App-header">
            {!showForm ? (
                <>
                    <button onClick={() => filterTodos('all')}>All</button>
                    <button onClick={() => filterTodos('urgent')}>Urgent</button>
                    <button onClick={() => filterTodos('important')}>Important</button>
                    <button onClick={() => setShowForm(true)}>Add Todo</button>
                    <button onClick={() => filterTodos('delete')}>Show Marked for Deletion</button>
                    {deleteMode && <button onClick={handleDeleteConfirmation}>Confirm Delete</button>}
                    <button onClick={() => setDeleteMode(!deleteMode)}>
                        {deleteMode ? "Cancel Delete" : "Mark as Done"}
                    </button>
                    <TodoList todos={displayTodos} deleteMode={deleteMode} toDelete={toDelete} toggleDelete={toggleDelete} />
                </>
            ) : (
                <TodoForm addTodo={addTodo} />
            )}
            <TodoTable />
        </div>
    );
    



    

}
