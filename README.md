<h2>Overview</h2>

This Chrome extension was built to empower non-programmers to scrape data from the web.  Rather than write code in a scraping language, users demonstrate how they would collect their data if they were going to scrape it by hand.  They fill out the first row of a spreadsheet, and the tool fills out the rest.

The tool currently targets relational data and pages with consistent structures.

<h2>Directions</h2>

<b>1.</b> Click on the Relation Scraper (RS) icon in the upper right of the browser window.  This opens the RS control panel, shown at the left in the screen capture below.

![Image for direction 1.](/readme/demo1.png?raw=true)

<b>2.</b> Open a fresh tab in which to conduct your demonstration.

![Image for direction 2.](/readme/demo2.png?raw=true)

<b>3.</b> Click on the "Demonstrate List" button.  This will open the controls for selecting a list from a webage.

![Image for direction 3.](/readme/demo3.png?raw=true)

<b>4.</b> On the webpage, select items for which you want Relation Scraper to scrape data.  For instance, in the screen capture below, we want to scrape data for each author in Google Scholar that has been tagged with the "Computer Science" tag.  Items in the current list will be highlighted in blue.  To add non-highlighted items to the current list, click on them.  To remove highlighted items from the current list, click on them.  The first page of the list will be shown in the control panel.

![Image for direction 4.](/readme/demo4.png?raw=true)

<b>5.</b> If you're scraping from a multi-page list, indicate how to get to the next set of list items.  Is there a next button?  A more button?  Do you scroll for more?  Click the relevant button on the RS control panel.

![Image for direction 5.](/readme/demo5.png?raw=true)

<b>6.</b> If the next set of list items is accessed with a next button or a more button (and you've already clicked on the appropriate button in the RS control panel to indicate this), click the next button or more button in the webpage.

![Image for direction 6.](/readme/demo6.png?raw=true)

<b>7.</b> If you're scraping from an extremeley long list, you'll probably want to limit the number of list items you collect.  Here, we set a 10 item limit.

![Image for direction 7.](/readme/demo7.png?raw=true)

<b>8.</b> After clicking the "Done" button on the list demonstration panel, you'll see what your list demonstration has added to the first row of your spreadsheet.  In the screen capture below, we see that the first column of our dataset's first row will be "vapnik."  At the bottom of the control panel, we see the first row so far.  Right now, the first row is just that one cell.

![Image for direction 8.](/readme/demo8.png?raw=true)

<b>9.</b> Next we'll demonstrate an interaction that we want RS to repeat for each item in the list.  But we'll only demonstrate it for the first item.  Click the "Demonstrate an Interaction" button to get started.

![Image for direction 9.](/readme/demo9.png?raw=true)

<b>10.</b> Click the "Start Recording" button to begin the interaction.

![Image for direction 10.](/readme/demo10.png?raw=true)

<b>11.</b> Now interact with the webpage just as you normally would.  Navigate to whatever information you want to collect for the first row of your spreadsheet.  In the screen capture below, we've started the recording, then clicked on the first item in our list, and we're now on the author's individual page.

![Image for direction 11.](/readme/demo11.png?raw=true)

<b>12.</b> To collect data during an interaction demonstration, click the "Start Capturing" button.

![Image for direction 12.](/readme/demo11.png?raw=true)

<b>13.</b> Click on data in the webpage to indicate that you want to add it to the first row.  In the screen capture below, we've clicked on the box that contains the author's tags.  The data captured so far is shown in the RS control panel.  Once you've captured all the data you want, click the "Done Capturing" button.

![Image for direction 13.](/readme/demo12.png?raw=true)

<b>14.</b> After clicking the "Done Recording" button on the interaction demonstration panel, you'll see what your interaction demonstration has added to the first row of your spreadsheet.  As before, you'll see the first row so far at the bottom of the control panel.  Repeat steps 3 through 13 until you've completed the whole first row of your spreadsheet.

![Image for direction 14.](/readme/demo13.png?raw=true)

<b>15.</b> Now that the whole first row of your spreadsheet is complete, you're ready to run RS.  Click the "Run" button, and let RS do the scraping for you!

![Image for direction 15.](/readme/demo14.png?raw=true)

<b>16.</b> Once RS has finished running, find your full dataset in the control panel.

![Image for direction 16.](/readme/demo15.png?raw=true)

<hr>
