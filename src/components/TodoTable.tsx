import React, { useState } from 'react';
import styles from './TodoTable.module.css';

type TodoType = {
    id: number;
    name: string;
    urgent: boolean;
    important: boolean;
};

type TodoTableProps = {
    todos: TodoType[];
};

const TodoTable: React.FC = () => {
    const [todos, setTodos] = useState<TodoType[]>([
        {
            name: 'Sample Todo 1',
            id: 1,
            urgent: true,
            important: false
        },
        {
            name: 'Sample Todo 2',
            id: 2,
            urgent: false,
            important: true
        }
        // ... add more sample todos or fetch from an API
    ]);

    return (
        <table className={styles.table}>
            <thead>
                <tr>
                    <th className={styles.header}>Name</th>
                    <th className={styles.header}>ID</th>
                    <th className={styles.header}>Urgent</th>
                    <th className={styles.header}>Important</th>
                </tr>
            </thead>
            <tbody>
                {todos.map(todo => (
                    <tr key={todo.id} className={styles.row}>
                        <td>{todo.name}</td>
                        <td>{todo.id}</td>
                        <td>{todo.urgent ? 'Yes' : 'No'}</td>
                        <td>{todo.important ? 'Yes' : 'No'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default TodoTable;
