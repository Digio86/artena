<?php
/*
Template Name: Full Width
*/
get_header(); ?>



<div id="page-full-width" role="main">


<?php while ( have_posts() ) : the_post(); ?>
  <article>
      <header>
          <h1 class="entry-title"><?php the_title(); ?></h1>
      </header>
      <div class="entry-content">
          <?php the_content(); ?>
      </div>
  </article>
<?php endwhile;?>

</div>

<?php get_footer();
