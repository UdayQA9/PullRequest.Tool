document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('header');
    const formSection = document.getElementById('form-section');
    const resultsSection = document.getElementById('results-section');
    const stickyUserPanel = document.getElementById('sticky-user-panel');
    const stickyTablePanel = document.getElementById('sticky-table-panel');
    const userDetailsHeader = document.getElementById('user-details-header');
    const prTableHeader = document.getElementById('pr-table-header');
    const resultsContainer = document.getElementById('results-container');
    const userDetailsPanel = document.getElementById('userDetailsPanel');

    // Function to set appropriate heights for scrollable areas
    function setScrollableHeights() {
        const windowHeight = window.innerHeight;
        const headerHeight = header.offsetHeight;
        const panelHeight = windowHeight - 220; // Account for headers and margins
        
        // Set minimum heights to ensure panels are visible
        const minHeight = 400;
        const finalHeight = Math.max(panelHeight, minHeight);
        
        // Apply heights to scrollable containers
        document.querySelectorAll('.overflow-y-auto').forEach(el => {
            el.style.maxHeight = `${finalHeight}px`;
        });
    }

    // Set initial heights
    setScrollableHeights();
    
    // Update heights on window resize
    window.addEventListener('resize', setScrollableHeights);

    // Function to check if an element is in viewport
    function isInViewport(el) {
        const rect = el.getBoundingClientRect();
        return (
            rect.top <= 70 && // Adjust for header height
            rect.bottom >= 0
        );
    }

    // Handle scroll events
    window.addEventListener('scroll', () => {
        // Add shadow to main header when scrolling
        if (window.scrollY > 10) {
            header.classList.add('shadow-md');
        } else {
            header.classList.remove('shadow-md');
        }
        
        // Make results section sticky when scrolling past the form section
        const formSectionBottom = formSection.getBoundingClientRect().bottom;
        const headerHeight = header.offsetHeight;
        
        if (formSectionBottom <= headerHeight + 20) { // Scrolled past form section
            // Make results section sticky
            resultsSection.classList.add('sticky', 'top-20', 'z-20');
            
            // Set height for the scrollable content
            const availableHeight = window.innerHeight - 180; 
            userDetailsPanel.style.maxHeight = `${availableHeight}px`;
            document.querySelector('#sticky-table-panel .overflow-y-auto').style.maxHeight = `${availableHeight}px`;

            // Apply background for better appearance when sticky
            resultsContainer.classList.add('bg-opacity-95', 'backdrop-blur-sm');
        } else {
            // Remove sticky when form section is visible
            resultsSection.classList.remove('sticky', 'top-20', 'z-20');
            resultsContainer.classList.remove('bg-opacity-95', 'backdrop-blur-sm');
        }
    });

    const fetchButton = document.getElementById('fetchButton');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');
    const pullRequestsContainer = document.getElementById('pullRequests');
    const userSearchBox = document.getElementById('userSearchBox');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const exportButton = document.getElementById('exportButton');
    const exportButtonDesktop = document.getElementById('exportButtonDesktop');

    let allPullRequests = [];
    let selectedPullRequest = null;

    // Event listeners
    fetchButton.addEventListener('click', fetchPullRequests);
    userSearchBox.addEventListener('input', filterPullRequestsByUser);
    clearSearchBtn.addEventListener('click', clearSearch);
    exportButton.addEventListener('click', exportToExcel);
    exportButtonDesktop.addEventListener('click', exportToExcel);
    
    // Auto-fetch pull requests when page loads
    fetchPullRequests();

    async function fetchPullRequests() {
        // Get input values
        const organization = document.getElementById('organization').value.trim();
        const project = document.getElementById('project').value.trim();
        const repository = document.getElementById('repository').value.trim();
        const pat = document.getElementById('pat').value.trim();
        const branch = document.getElementById('branch').value.trim();
        const statusFilter = document.getElementById('status').value;

        // Reset all field borders
        document.querySelectorAll('input, select').forEach(field => {
            field.classList.remove('border-red-500');
        });
        
        // Validate required inputs
        let hasError = false;
        
        if (!organization) {
            document.getElementById('organization').classList.add('border-red-500');
            hasError = true;
        }
        if (!project || project === 'Select') {
            document.getElementById('project').classList.add('border-red-500');
            hasError = true;
        }
        if (!repository) {
            document.getElementById('repository').classList.add('border-red-500');
            hasError = true;
        }
        if (!pat) {
            document.getElementById('pat').classList.add('border-red-500');
            hasError = true;
        }

        if (hasError) {
            // Hide any current error message
            errorMessage.style.display = 'none';
            return;
        }

        // Show loading spinner and hide error message
        loadingSpinner.style.display = 'flex';
        errorMessage.style.display = 'none';
        pullRequestsContainer.innerHTML = '';
        clearSearch(); // Clear any existing search
        clearUserDetails(); // Clear user details

        try {
            // Create base64 encoded authorization header
            const authHeader = `Basic ${btoa(`:${pat}`)}`;
            
            // Construct the Azure DevOps API URL for pull requests
            let apiUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/pullrequests?api-version=6.0`;
            
            // Add status filter if not "all"
            if (statusFilter !== 'all') {
                apiUrl += `&searchCriteria.status=${statusFilter}`;
            }

            // Add branch filter if provided
            if (branch) {
                apiUrl += `&searchCriteria.targetRefName=refs/heads/${branch}`;
            }
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            
            // Hide loading spinner
            loadingSpinner.style.display = 'none';
            
            // Store pull requests globally and display them
            allPullRequests = data.value;
            displayPullRequests(allPullRequests);
        } catch (error) {
            // Hide loading spinner and show error
            loadingSpinner.style.display = 'none';
            showError(`Failed to fetch pull requests: ${error.message}`);
        }
    }

    // Function to fetch work items for a specific pull request
    async function fetchWorkItemsForPR(pullRequest) {
        const organization = document.getElementById('organization').value.trim();
        const project = document.getElementById('project').value.trim();
        const pat = document.getElementById('pat').value.trim();
        const prId = pullRequest.pullRequestId;
        
        try {
            // Create base64 encoded authorization header
            const authHeader = `Basic ${btoa(`:${pat}`)}`;
            
            console.log(`Fetching work items for PR #${prId}`);
            
            // First get the work item references from the PR - using the repository endpoint
            const apiUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${pullRequest.repository.id}/pullRequests/${prId}/workitems?api-version=6.0`;
            
            console.log(`API URL: ${apiUrl}`);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error response: ${errorText}`);
                throw new Error(`Error: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Work item references:', data);
            
            if (!data.value || data.value.length === 0) {
                console.log('No work items found for this PR');
                return [];
            }
            
            // Get the work item IDs
            const workItemIds = data.value.map(wi => wi.id);
            console.log('Work item IDs:', workItemIds);
            
            // Now get the details for each work item
            const workItemDetailsUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems?ids=${workItemIds.join(',')}&fields=System.Id,System.Title,System.State,System.WorkItemType&api-version=6.0`;
            
            console.log(`Work item details URL: ${workItemDetailsUrl}`);
            
            const detailsResponse = await fetch(workItemDetailsUrl, {
                method: 'GET',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                }
            });

            if (!detailsResponse.ok) {
                const errorText = await detailsResponse.text();
                console.error(`Error response for details: ${errorText}`);
                throw new Error(`Error: ${detailsResponse.status} - ${detailsResponse.statusText}`);
            }

            const workItemDetails = await detailsResponse.json();
            console.log('Work item details:', workItemDetails);
            
            return workItemDetails.value || [];
            
        } catch (error) {
            console.error("Error fetching work items:", error);
            
            // Try alternative API endpoint if the first one fails
            try {
                console.log("Trying alternative work items API endpoint...");
                
                // Alternative method directly using PR ID in the project
                const altApiUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/pullrequests/${prId}/workitems?api-version=6.0`;
                
                console.log(`Alternative API URL: ${altApiUrl}`);
                
                const authHeader = `Basic ${btoa(`:${pat}`)}`;
                const altResponse = await fetch(altApiUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': authHeader,
                        'Content-Type': 'application/json',
                    }
                });

                if (!altResponse.ok) {
                    throw new Error(`Alternative API error: ${altResponse.status}`);
                }

                const altData = await altResponse.json();
                console.log('Alternative API response:', altData);
                
                if (!altData.value || altData.value.length === 0) {
                    return [];
                }
                
                // Get the work item IDs
                const workItemIds = altData.value.map(wi => wi.id);
                
                // Get details
                const workItemDetailsUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems?ids=${workItemIds.join(',')}&fields=System.Id,System.Title,System.State,System.WorkItemType&api-version=6.0`;
                
                const detailsResponse = await fetch(workItemDetailsUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': authHeader,
                        'Content-Type': 'application/json',
                    }
                });

                const workItemDetails = await detailsResponse.json();
                return workItemDetails.value || [];
                
            } catch (altError) {
                console.error("Alternative method also failed:", altError);
                return [];
            }
        }
    }

    function filterPullRequestsByUser() {
        const searchTerm = userSearchBox.value.trim().toLowerCase();
        
        if (!searchTerm) {
            // If search is empty, show all pull requests
            displayPullRequests(allPullRequests);
            return;
        }
        
        // Filter pull requests by creator or reviewer name
        const filteredPRs = allPullRequests.filter(pr => {
            // Check created by username
            const creatorName = pr.createdBy?.displayName?.toLowerCase() || '';
            
            // Check completed by username if applicable
            const completedBy = pr.closedBy?.displayName?.toLowerCase() || '';
            
            // Return true if the search term is found in either creator or completedBy
            return creatorName.includes(searchTerm) || completedBy.includes(searchTerm);
        });
        
        displayPullRequests(filteredPRs);
    }

    function clearSearch() {
        userSearchBox.value = '';
        if (allPullRequests.length > 0) {
            displayPullRequests(allPullRequests);
        }
    }

    function clearUserDetails() {
        userDetailsPanel.innerHTML = '<p class="text-gray-500 text-center py-4">Select a pull request to see user details</p>';
        selectedPullRequest = null;
    }

    async function displayUserDetails(pullRequest) {
        // Clear previous data
        userDetailsPanel.innerHTML = '';
        
        if (!pullRequest) {
            userDetailsPanel.innerHTML = '<p class="text-gray-500 text-center py-4">No user details available</p>';
            return;
        }
        
        selectedPullRequest = pullRequest;
        
        // Show loading indicator for work items
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'flex justify-center my-3';
        loadingIndicator.innerHTML = `

            <div class="w-6 h-6 border-2 border-gray-300 border-t-azure-blue rounded-full animate-spin"></div>
            <span class="ml-2 text-sm text-gray-600">Loading work items...</span>
        `;
        
        // PR Details section
        const prDetailsSection = document.createElement('div');
        prDetailsSection.className = 'mb-4';
        
        const prDetailsHeader = document.createElement('h3');
        prDetailsHeader.className = 'text-lg font-semibold text-azure-blue border-b border-gray-200 pb-2 mb-3';
        prDetailsHeader.textContent = 'Pull Request Details';
        prDetailsSection.appendChild(prDetailsHeader);
        
        // PR details content
        const prDetails = document.createElement('div');
        prDetails.className = 'space-y-2 text-sm';
        
        // Add PR #
        const prNumber = document.createElement('div');
        prNumber.innerHTML = `<span class="font-medium">PR #:</span> ${pullRequest.pullRequestId}`;
        prDetails.appendChild(prNumber);
        
        // Add PR title
        const prTitle = document.createElement('div');
        prTitle.innerHTML = `<span class="font-medium">Title:</span> ${pullRequest.title}`;
        prDetails.appendChild(prTitle);
        
        // Add PR status
        const prStatus = document.createElement('div');
        const statusClass = getPrStatusClass(pullRequest.status);
        prStatus.innerHTML = `
            <span class="font-medium">Status:</span> 
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}">${pullRequest.status || 'active'}</span>
        `;
        prDetails.appendChild(prStatus);
        
        // Add PR source and target branches if available
        if (pullRequest.sourceRefName) {
            const sourceBranch = document.createElement('div');
            sourceBranch.innerHTML = `<span class="font-medium">Source Branch:</span> ${getSimpleBranchName(pullRequest.sourceRefName)}`;
            prDetails.appendChild(sourceBranch);
        }
        
        if (pullRequest.targetRefName) {
            const targetBranch = document.createElement('div');
            targetBranch.innerHTML = `<span class="font-medium">Target Branch:</span> ${getSimpleBranchName(pullRequest.targetRefName)}`;
            prDetails.appendChild(targetBranch);
        }
        
        prDetailsSection.appendChild(prDetails);
        
        // Create author section
        const authorSection = document.createElement('div');
        authorSection.className = 'mb-6';
        
        // Author header
        const authorHeader = document.createElement('h3');
        authorHeader.className = 'text-lg font-semibold text-azure-blue border-b border-gray-200 pb-2 mb-3';
        authorHeader.textContent = 'Author';
        authorSection.appendChild(authorHeader);
        
        // Author details
        const author = pullRequest.createdBy;
        if (author) {
            const authorCard = createUserCard(author, 'Created On: ' + formatDate(pullRequest.creationDate));
            authorSection.appendChild(authorCard);
        }
        
        // Reviewers section
        const reviewersSection = document.createElement('div');
        reviewersSection.className = 'mb-6';
        
        // Reviewers header
        const reviewersHeader = document.createElement('h3');
        reviewersHeader.className = 'text-lg font-semibold text-azure-blue border-b border-gray-200 pb-2 mb-3';
        reviewersHeader.textContent = 'Reviewers';
        reviewersSection.appendChild(reviewersHeader);
        
        // Add reviewers if available
        if (pullRequest.reviewers && pullRequest.reviewers.length > 0) {
            pullRequest.reviewers.forEach(reviewer => {
                const reviewerStatus = getReviewerStatusText(reviewer.vote);
                const reviewerCard = createUserCard(reviewer, `Status: ${reviewerStatus}`);
                reviewersSection.appendChild(reviewerCard);
            });
        } else {
            const noReviewers = document.createElement('p');
            noReviewers.className = 'text-gray-500 text-center py-2';
            noReviewers.textContent = 'No reviewers assigned';
            reviewersSection.appendChild(noReviewers);
        }
        
        // Work Items section
        const workItemsSection = document.createElement('div');
        workItemsSection.className = 'mb-6';
        
        // Work Items header
        const workItemsHeader = document.createElement('h3');
        workItemsHeader.className = 'text-lg font-semibold text-azure-blue border-b border-gray-200 pb-2 mb-3';
        workItemsHeader.textContent = 'Linked Work Items';
        workItemsSection.appendChild(workItemsHeader);
        
        // Add loading indicator initially
        workItemsSection.appendChild(loadingIndicator);
        
        // Add all sections to the panel
        userDetailsPanel.appendChild(prDetailsSection);
        userDetailsPanel.appendChild(authorSection);
        userDetailsPanel.appendChild(reviewersSection);
        userDetailsPanel.appendChild(workItemsSection);
        
        // Fetch work items after displaying the initial UI
        const workItems = await fetchWorkItemsForPR(pullRequest);
        
        // Remove loading indicator
        workItemsSection.removeChild(loadingIndicator);
        
        // Display work items
        if (workItems.length > 0) {
            const organization = document.getElementById('organization').value.trim();
            const project = document.getElementById('project').value.trim();
            
            workItems.forEach(workItem => {
                const fields = workItem.fields;
                const workItemId = workItem.id;
                const workItemTitle = fields['System.Title'];
                const workItemType = fields['System.WorkItemType'];
                const workItemState = fields['System.State'];
                
                // Create work item card
                const workItemCard = document.createElement('div');
                workItemCard.className = 'bg-white rounded-md shadow-sm mb-2 p-3';
                
                // Determine state color
                let stateClass = 'bg-gray-100 text-gray-800';
                if (workItemState === 'Active') stateClass = 'bg-blue-100 text-blue-800';
                if (workItemState === 'Closed') stateClass = 'bg-green-100 text-green-800';
                if (workItemState === 'Resolved') stateClass = 'bg-purple-100 text-purple-800';
                
                // Construct work item URL
                const workItemUrl = `https://dev.azure.com/${organization}/${project}/_workitems/edit/${workItemId}`;
                
                // Populate work item card
                workItemCard.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <a href="${workItemUrl}" target="_blank" class="font-medium text-azure-blue hover:underline">
                                ${workItemType} #${workItemId}
                            </a>
                            <div class="text-sm mt-1">${workItemTitle}</div>
                        </div>
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium ${stateClass}">${workItemState}</span>
                    </div>
                `;
                
                workItemsSection.appendChild(workItemCard);
            });
        } else {
            const noWorkItems = document.createElement('p');
            noWorkItems.className = 'text-gray-500 text-center py-2';
            noWorkItems.textContent = 'No work items linked to this pull request';
            workItemsSection.appendChild(noWorkItems);
        }
    }

    function createUserCard(user, subText) {
        const card = document.createElement('div');
        card.className = 'flex items-center p-3 bg-white rounded-md shadow-sm mb-2';
        
        // User avatar container
        const avatar = document.createElement('div');
        avatar.className = 'w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center';
        
        // Check if user exists and has valid properties
        if (user && user.displayName) {
            // Get initials for fallback
            const initials = user.displayName
                .split(' ')
                .map(name => name.charAt(0))
                .join('')
                .substring(0, 2)
                .toUpperCase();
                
            // Always create a fallback with initials first
            avatar.innerHTML = `<span class="text-azure-blue font-medium">${initials}</span>`;
            avatar.classList.add('bg-azure-blue/10');
            
            // Try to load image if available (with authentication)
            if (user.imageUrl) {
                // Get PAT for authentication
                const pat = document.getElementById('pat').value.trim();
                if (pat) {
                    // Create an image element
                    const img = document.createElement('img');
                    
                    // Try to authenticate the image request using PAT
                    fetchAndCreateImageBlob(user.imageUrl, pat).then(blobUrl => {
                        if (blobUrl) {
                            img.src = blobUrl;
                            img.alt = user.displayName;
                            img.className = 'w-full h-full object-cover';
                            
                            // Handle image loading errors
                            img.onerror = function() {
                                // Image already has fallback in place, just remove this img
                                this.remove();
                            };
                            
                            // Clear the avatar and add the image
                            avatar.innerHTML = '';
                            avatar.classList.remove('bg-azure-blue/10');
                            avatar.appendChild(img);
                        }
                    }).catch(() => {
                        // Fallback is already in place, do nothing
                    });
                }
            }
        } else {
            // Fallback for completely missing user data
            avatar.innerHTML = `<span class="text-azure-blue font-medium">?</span>`;
            avatar.classList.add('bg-azure-blue/10');
        }
        
        // User info
        const userInfo = document.createElement('div');
        userInfo.className = 'ml-3';
        userInfo.innerHTML = `
            <div class="font-medium">${(user && user.displayName) || 'Unknown User'}</div>
            <div class="text-sm text-gray-500">${subText || ''}</div>
        `;
        
        card.appendChild(avatar);
        card.appendChild(userInfo);
        return card;
    }

    // Helper function to fetch images with authentication and convert to blob URLs
    async function fetchAndCreateImageBlob(imageUrl, pat) {
        try {
            // Create base64 encoded authorization header
            const authHeader = `Basic ${btoa(`:${pat}`)}`;
            
            // Fetch the image with authorization
            const response = await fetch(imageUrl, {
                method: 'GET',
                headers: {
                    'Authorization': authHeader
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load image: ${response.status}`);
            }
            
            // Get the blob from the response
            const blob = await response.blob();
            
            // Create a URL for the blob
            return URL.createObjectURL(blob);
        } catch (error) {
            console.log("Error fetching image:", error);
            return null;
        }
    }

    function getReviewerStatusText(vote) {
        switch(vote) {
            case 10: return 'Approved';
            case 5: return 'Approved with suggestions';
            case 0: return 'No vote';
            case -5: return 'Waiting for author';
            case -10: return 'Rejected';
            default: return 'No vote';
        }
    }

    function getPrStatusClass(status) {
        switch(status) {
            case 'completed': return 'bg-green-100 text-green-800';
            case 'abandoned': return 'bg-red-100 text-red-800';
            default: return 'bg-blue-100 text-blue-800'; // active or other
        }
    }

    function displayPullRequests(pullRequests) {
        // Clear existing content
        pullRequestsContainer.innerHTML = '';

        if (pullRequests.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="5" class="text-center py-4 text-gray-500">No pull requests found.</td>';
            pullRequestsContainer.appendChild(emptyRow);
            return;
        }

        // Get organization, project, and repository values for constructing correct URLs
        const organization = document.getElementById('organization').value.trim();
        const project = document.getElementById('project').value.trim();
        const repository = document.getElementById('repository').value.trim();

        // Loop through pull requests and create table rows
        pullRequests.forEach(pr => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 transition-colors cursor-pointer';
            
            // Set selected class if this is the selected PR
            if (selectedPullRequest && selectedPullRequest.pullRequestId === pr.pullRequestId) {
                row.classList.add('bg-azure-blue/10');
            }
            
            // Construct the proper Azure DevOps PR URL
            const formattedUrl = `https://dev.azure.com/${organization}/${project}/_git/${repository}/pullrequest/${pr.pullRequestId}`;
            
            // Format date
            const creationDate = formatDate(pr.creationDate);
            
            // Determine status class & text
            const statusClass = getPrStatusClass(pr.status);
            
            // Build the table row HTML
            row.innerHTML = `
                <td class="px-4 py-3 border-b">
                    <a href="${formattedUrl}" target="_blank" class="text-azure-blue hover:underline">${pr.title}</a>
                </td>
                <td class="px-4 py-3 border-b">${pr.pullRequestId}</td>
                <td class="px-4 py-3 border-b">${pr.createdBy?.displayName || 'Unknown'}</td>
                <td class="px-4 py-3 border-b">${creationDate}</td>
                <td class="px-4 py-3 border-b">
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">${pr.status || 'active'}</span>
                </td>
            `;
            
            // Add click event to show user details
            row.addEventListener('click', (e) => {
                // Don't trigger if clicking the actual link which opens in new tab
                if (e.target.tagName === 'A') return;
                
                // Remove selected class from all rows
                document.querySelectorAll('#pullRequests tr').forEach(r => {
                    r.classList.remove('bg-azure-blue/10');
                });
                
                // Add selected class to current row
                row.classList.add('bg-azure-blue/10');
                
                // Display user details
                displayUserDetails(pr);
                
                // Scroll to user details panel on mobile
                if (window.innerWidth < 768) {
                    document.getElementById('userDetailsPanel').scrollIntoView({ behavior: 'smooth' });
                }
            });
            
            pullRequestsContainer.appendChild(row);
        });
    }

    // Function to export pull requests data to Excel
    function exportToExcel() {
        if (allPullRequests.length === 0) {
            showError('No data to export. Please fetch pull requests first.');
            return;
        }

        try {
            // Show loading indicator temporarily
            loadingSpinner.style.display = 'flex';
            
            // Get organization, project, and repository values for URLs
            const organization = document.getElementById('organization').value.trim();
            const project = document.getElementById('project').value.trim();
            const repository = document.getElementById('repository').value.trim();
            const status = document.getElementById('status').value;
            const branch = document.getElementById('branch').value.trim();
            
            // Format data for export with reordering to put URL as 5th column
            const exportData = allPullRequests.map(pr => {
                // Get source and target branch names without refs/heads/ prefix
                const sourceBranch = pr.sourceRefName ? getSimpleBranchName(pr.sourceRefName) : 'N/A';
                const targetBranch = pr.targetRefName ? getSimpleBranchName(pr.targetRefName) : 'N/A';
                
                // Construct PR URL
                const prUrl = `https://dev.azure.com/${organization}/${project}/_git/${repository}/pullrequest/${pr.pullRequestId}`;
                
                // Create a simplified PR object for export with URL as the 5th column
                return {
                    'PR #': pr.pullRequestId,
                    'Title': pr.title,
                    'Created By': pr.createdBy?.displayName || 'Unknown',
                    'Created Date': formatDateForExcel(pr.creationDate),
                    'PR URL': { v: prUrl, l: { Target: prUrl, Tooltip: "Open Pull Request" } }, // Add hyperlink in 5th column
                    'Source Branch': sourceBranch,
                    'Target Branch': targetBranch,
                    'Status': pr.status || 'active',
                    'Description': pr.description || '',
                    'Closed Date': formatDateForExcel(pr.closedDate),
                    'Closed By': pr.closedBy?.displayName || '',
                    'Merge Status': pr.mergeStatus || ''
                };
            });

            // Create a worksheet
            const worksheet = XLSX.utils.json_to_sheet(exportData);

            // Column widths for better readability
            const colWidths = [
                { wch: 10 },  // PR #
                { wch: 40 },  // Title
                { wch: 20 },  // Created By
                { wch: 20 },  // Created Date
                { wch: 45 },  // PR URL (5th column now)
                { wch: 20 },  // Source Branch
                { wch: 20 },  // Target Branch
                { wch: 15 },  // Status
                { wch: 50 },  // Description (moved later)
                { wch: 20 },  // Closed Date
                { wch: 20 },  // Closed By
                { wch: 15 },  // Merge Status
            ];
            worksheet['!cols'] = colWidths;

            // Create a workbook
            const workbook = XLSX.utils.book_new();
            
            // Add the worksheet to the workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Pull Requests');

            // Generate Excel file name with current date
            const currentDate = new Date().toISOString().slice(0, 10);
            const fileName = `${project}_${repository}_PRs_${status}_${currentDate}.xlsx`;
            
            // Export to Excel file
            XLSX.writeFile(workbook, fileName);
            
            // Hide loading spinner
            setTimeout(() => {
                loadingSpinner.style.display = 'none';
                
                // Show success message
                const successMsg = document.createElement('div');
                successMsg.className = 'fixed bottom-4 right-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-md z-50';
                successMsg.innerHTML = '<div class="flex items-center"><svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Export completed successfully!</div>';
                document.body.appendChild(successMsg);
                
                // Remove success message after 3 seconds
                setTimeout(() => {
                    document.body.removeChild(successMsg);
                }, 3000);
            }, 500);
            
        } catch (error) {
            loadingSpinner.style.display = 'none';
            showError(`Failed to export data: ${error.message}`);
        }
    }

    // Format date for Excel (keeping timezone info)
    function formatDateForExcel(dateString) {
        if (!dateString) return '';
        return new Date(dateString).toISOString();
    }
    
    function formatDate(dateString) {
        if (!dateString) return 'Unknown';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Helper function to extract branch name from ref
    function getSimpleBranchName(refName) {
        if (!refName) return 'Unknown';
        return refName.replace('refs/heads/', '');
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
});