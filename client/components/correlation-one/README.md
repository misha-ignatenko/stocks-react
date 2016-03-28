Correlation-One Challenge Info

Instructions
Click the "Enter Prices" button and enter the sample csv data from the Google Doc into the text box:
---
https://docs.google.com/document/d/10R5SLzweoFGb5z6s9Ul7eLNhYrJgmODK1ObXb0gjj9c/edit?pref=2&pli=1

You will see the text box and csv values turn into a table where column 1 has date and all other columns have open-to-close price changes in hundredths (NOT percents). The first 50 rows of data have values in column 2 (S1), and the last 50 rows of data have empty cell in column 2 (S1).

The pre-set values for tolerance, max iter, and step size are based on the research I have done (see below).
---
Tolerance refers to gradient sum of squares that determines whether gradient descent converges.

Locate and click the "Predict" button below the table.
---


Predictions will take a few seconds and will appear at the bottom of the page in csv format.
---

4 Questions.
---
1. S2...S10 are relevant in predicting S1. I believe that if we use S1 in predicting S1, we might run into the issue of overfitting our solution. I implemented the simplest multiple regression gradient descent algorithm in which I considered S2...S10 from the same day to get weights for each S2...S10 that factor into S1 (plus a random noise constant, which I set to 0.001).

2. Unable to answer this question because did not have access to the dataset.

3. My confidence in the model depends on whether multiple regression converges before hitting the maximum number of allowed iterations (maxIter). In my simulations I always ran into hitting the max number of iterations, even after I increased gradient descent step size. However, if step size is too large, then gradient descent might never converge.

4. I used multiple gradient descent because I believe it's the simplest algorithm for this problem. If given more time I could implement other more complex multiple regression algorithms (Ridge, k-NN, Kernel), such as ignoring stocks whose weights are relatively low in predicting S1 compared to other stocks' weights.


Research Steps
---


