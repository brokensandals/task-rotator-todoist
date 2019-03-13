# Task Rotator for Todoist

![docker build status](https://img.shields.io/docker/cloud/build/brokensandals/task-rotator-todoist.svg)

This tool allows you to have recurring tasks in Todoist whose task name changes, according to a defined rotation, every time you complete the task.

This tool is not created by, affiliated with, or supported by Doist.

## Example Usage

Let's say that I want a task that reminds me to play piano every day.
But I don't focus on the same thing every day; instead, I focus on practicing music I already know on one day, practicing new music I'm learning the next day, and writing new music of my own on the third day.
Then the cycle repeats.

Using this tool, I can set that up by creating a recurring task and adding a comment to it that specifies the rotation:

![screenshot of creating a rotating task](docs/creating-a-rotation.png)

The comment should start with a line containing just the text `ROTATION:`, followed by one line for each task in the cycle, in the desired order.
The task name should match one of the entries in the comment.

In this example, the current task in the rotation is `learn new piano music`.
When you mark this task as completed, since it's a recurring task, Todoist will move it to its next due date.

When the task rotator tool runs, the task's name will be changed from `learn new piano music` to the next entry in the rotation, `work on piano compositions`.

## Why Would Anyone Want This?

This is useful for cases where you want to give attention to each of a few different things every few days, but you don't want them to pile up when you miss a day.

In the piano example above, I used to have three separate tasks (for practicing, learning, and composing) that recurred on different days.
But if I missed a couple days, I would now have all three tasks showing as due, which creates a lot of clutter that obscures what's really important on the todo list.
It's not practical or important for me to catch up on all three at once; rather, I just want a reminder to pick up wherever I left off in the cycle.

## Prerequisites

- You must have Todoist Premium, because this tool requires task notes and the activity log.
- Copy your API token from Settings in Todoist.

## Running the Tool

- Ensure you have Node installed (tested with Node 11).
- Run `npm install` to fetch dependencies.
- Set the environment variable for your Todoist API token, e.g. `export TODOIST_API_TOKEN=your_token_here`
- Run `./bin/update-rotating-todoist-tasks`

To be useful, you'll need to have this run automatically on a schedule (say, a couple times per day), but that's currently left as an exercise for the reader.

## How it Works

Retrieves three data sets from the Todoist API:

- The activity log, so we can find all recent task completions and the name of each task at the time it was completed.
- All tasks, so we can see the current names of each task.
- All notes, so we can find the rotation definition for each task.

If a task was completed recently, but its current name is different from the name it had when it was completed, then we ignore it.
This allows you to manually override the rotation schedule by just changing the name of the task after you complete it.

If a task doesn't exist any more, or if the task doesn't have a note that starts with the text `ROTATION:`, or if the task's name isn't found in the rotation, then we ignore it.

If we do find a rotation note for the task, we find the line in that note that matches the task's name, and change the task's name to the next line of the note.

All updates are made in a single batch call to the Todoist API.

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/brokensandals/task-rotator-todoist.

## License

The project is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).
